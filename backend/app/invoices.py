"""User-owned invoice *draft* workflow. Never submits to GIB or Mysoft.

All arithmetic is display-only: tax/legally valid special VAT base requires a
qualified integration. No real invoice numbers are allocated here.
"""
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from flask import Blueprint, g, jsonify, request
from sqlalchemy import func, or_
from . import db, AuditEvent
from .customers import Customer

bp = Blueprint("invoice_workflow", __name__, url_prefix="/api/invoices")
MONEY = Decimal("0.01")
ALLOWED_DOCS = {"e-fatura", "e-arsiv", "g-pusulasi"}
ALLOWED_PAYMENTS = {"Nakit", "Kredi Kartı", "Havale / EFT"}
ALLOWED_UNITS = {"gram", "adet"}
ALLOWED_KARATS = {"8", "14", "18", "21", "22", "24", "ziynet", "diger"}


class InvoiceDraft(db.Model):
    __tablename__ = "user_invoice_drafts"
    id = db.Column(db.Integer, primary_key=True)
    owner_id = db.Column(db.Integer, db.ForeignKey("app_users.id"), nullable=False, index=True)
    customer_id = db.Column(db.Integer, db.ForeignKey("user_customers.id"), nullable=False, index=True)
    document_type = db.Column(db.String(12), nullable=False)
    payment_method = db.Column(db.String(24), nullable=False)
    status = db.Column(db.String(24), nullable=False, default="draft", index=True)
    source = db.Column(db.String(18), nullable=False, default="manual")
    bank_reference = db.Column(db.String(80), nullable=True)
    notes = db.Column(db.String(300), nullable=False, default="")
    lines = db.Column(db.JSON, nullable=False)
    net_total = db.Column(db.Numeric(16, 2), nullable=False)
    fine_gram_total = db.Column(db.Numeric(16, 4), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False,
                           default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False,
                           default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        # Resolve *only* this owner's customer, and never expose TCKN here.
        name = db.session.scalar(db.select(Customer.full_name).where(
            Customer.owner_id == g.current_user_id, Customer.id == self.customer_id))
        return {
            "id": self.id, "reference": "PG-TAS-%06d" % self.id,
            "customerId": self.customer_id, "customerName": name or "Müşteri bulunamadı",
            "documentType": self.document_type, "paymentMethod": self.payment_method,
            "status": self.status, "source": self.source,
            "bankReference": self.bank_reference, "notes": self.notes,
            "lines": self.lines, "total": str(self.net_total),
            "fineGram": str(self.fine_gram_total),
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
            "officialDocument": False, "transmitted": False,
        }


def scope():
    return db.select(InvoiceDraft).where(InvoiceDraft.owner_id == g.current_user_id)


def decimal_field(value, max_value, places=2, min_value=Decimal("0")):
    if isinstance(value, bool) or not isinstance(value, (int, float, str, Decimal)):
        raise ValueError("numeric field required")
    try:
        number = Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise ValueError("invalid decimal")
    if not number.is_finite() or number < min_value or number > Decimal(str(max_value)):
        raise ValueError("decimal out of range")
    if number.as_tuple().exponent < -places:
        raise ValueError("decimal precision exceeded")
    return number


def parse_payload(payload):
    if not isinstance(payload, dict):
        raise ValueError("Geçersiz fatura verisi.")
    try:
        customer_id = int(payload.get("customerId"))
    except (TypeError, ValueError, OverflowError):
        raise ValueError("Müşteri seçin.")
    customer = db.session.scalar(db.select(Customer.id).where(
        Customer.owner_id == g.current_user_id, Customer.id == customer_id))
    if customer is None:
        raise ValueError("Bu müşteri hesabınızda bulunamadı.")
    doc = payload.get("documentType")
    payment = payload.get("paymentMethod")
    if doc not in ALLOWED_DOCS or payment not in ALLOWED_PAYMENTS:
        raise ValueError("Belge türü veya ödeme yöntemi geçersiz.")
    raw = payload.get("lines")
    if not isinstance(raw, list) or not 1 <= len(raw) <= 30:
        raise ValueError("Faturada 1-30 ürün kalemi olmalı.")
    parsed, total, fine = [], Decimal("0"), Decimal("0")
    for line in raw:
        if not isinstance(line, dict):
            raise ValueError("Ürün kalemi geçersiz.")
        name = line.get("name")
        if not isinstance(name, str) or not 2 <= len(name.strip()) <= 100:
            raise ValueError("Ürün adı 2-100 karakter olmalı.")
        if "doğrulanacak" in name.casefold():
            raise ValueError("Önce ürün/hizmet bilgisini doğrulayarak düzeltin.")
        karat = str(line.get("karat") or "")
        unit = str(line.get("unit") or "")
        if karat not in ALLOWED_KARATS or unit not in ALLOWED_UNITS:
            raise ValueError("Ayar veya miktar birimi geçersiz.")
        fineness = decimal_field(line.get("fineness"), "1", 3)
        quantity = decimal_field(line.get("quantity"), "1000", 0, Decimal("1"))
        grams = decimal_field(line.get("weightGram"), "100000", 3)
        price = decimal_field(line.get("unitPrice"), "100000000", 2)
        labor = decimal_field(line.get("workmanship"), "100000000", 2)
        if unit == "gram" and grams <= 0:
            raise ValueError("Gram ile satılan ürünün gramajı pozitif olmalı.")
        if unit == "adet" and grams < 0:
            raise ValueError("Gramaj geçersiz.")
        # In "gram", unit price is TL/gram; in "adet" it is TL/piece.
        amount = ((grams * price if unit == "gram" else price) + labor) * quantity
        amount = amount.quantize(MONEY, rounding=ROUND_HALF_UP)
        total += amount
        fine += grams * fineness * quantity
        if total > Decimal("9999999999"):
            raise ValueError("Toplam tutar üst sınırı aşıyor.")
        parsed.append({
            "name": name.strip(), "karat": karat, "unit": unit,
            "fineness": str(fineness), "quantity": int(quantity),
            "weightGram": str(grams), "unitPrice": str(price),
            "workmanship": str(labor), "amount": str(amount)
        })
    if total <= 0:
        raise ValueError("Toplam tutar sıfırdan büyük olmalı.")
    bank_reference = payload.get("bankReference") or None
    if bank_reference is not None:
        if not isinstance(bank_reference, str) or len(bank_reference.strip()) > 80:
            raise ValueError("Banka referansı geçersiz.")
        bank_reference = bank_reference.strip() or None
    notes = payload.get("notes") or ""
    if not isinstance(notes, str) or len(notes) > 300:
        raise ValueError("Not en fazla 300 karakter olabilir.")
    return {
        "customer_id": customer_id, "document_type": doc, "payment_method": payment,
        "lines": parsed, "net_total": total.quantize(MONEY),
        "fine_gram_total": fine.quantize(Decimal("0.0001")),
        "source": "bank_excel" if bank_reference else "manual",
        "bank_reference": bank_reference, "notes": notes.strip()
    }


def audit(action, record):
    db.session.add(AuditEvent(actor_id=str(g.current_user_id), action=action,
                              target=str(record.id), details={"status": record.status}))


def get_owned(invoice_id):
    return db.session.scalar(scope().where(InvoiceDraft.id == invoice_id))


@bp.get("")
def list_invoices():
    status = (request.args.get("status") or "all").strip()
    if status not in {"all", "draft", "ready", "simulated"}:
        return jsonify(error="invalid_status"), 400
    try:
        page = max(1, int(request.args.get("page", "1")))
    except ValueError:
        return jsonify(error="invalid_page"), 400
    statement = scope()
    if status != "all":
        statement = statement.where(InvoiceDraft.status == status)
    total = db.session.scalar(db.select(func.count()).select_from(statement.subquery()))
    records = db.session.scalars(statement.order_by(InvoiceDraft.id.desc()).offset(
        (page - 1) * 30).limit(30)).all()
    return jsonify(invoices=[r.to_dict() for r in records], total=total, page=page)


@bp.post("")
def create_invoice():
    try:
        values = parse_payload(request.get_json(silent=True))
    except ValueError as error:
        return jsonify(error="invalid_invoice", message=str(error)), 400
    record = InvoiceDraft(owner_id=g.current_user_id, status="draft", **values)
    db.session.add(record)
    db.session.flush()
    audit("invoice.draft.create", record)
    db.session.commit()
    return jsonify(invoice=record.to_dict()), 201


@bp.get("/<int:invoice_id>")
def get_invoice(invoice_id):
    record = get_owned(invoice_id)
    if record is None:
        return jsonify(error="not_found"), 404
    return jsonify(invoice=record.to_dict())


@bp.patch("/<int:invoice_id>")
def edit_invoice(invoice_id):
    record = get_owned(invoice_id)
    if record is None:
        return jsonify(error="not_found"), 404
    if record.status != "draft":
        return jsonify(error="invalid_transition", message="Yalnızca taslaklar düzenlenebilir."), 409
    try:
        values = parse_payload(request.get_json(silent=True))
    except ValueError as error:
        return jsonify(error="invalid_invoice", message=str(error)), 400
    for key, value in values.items():
        setattr(record, key, value)
    audit("invoice.draft.update", record)
    db.session.commit()
    return jsonify(invoice=record.to_dict())


@bp.post("/<int:invoice_id>/review")
def mark_reviewed(invoice_id):
    record = get_owned(invoice_id)
    if record is None:
        return jsonify(error="not_found"), 404
    if record.status != "draft":
        return jsonify(error="invalid_transition"), 409
    if any(line.get("requiresReview") for line in record.lines):
        return jsonify(error="verification_required", message="Banka taslağı için önce ürün ve belge bilgilerini doğrulayın."), 409
    record.status = "ready"
    audit("invoice.review.approve", record)
    db.session.commit()
    return jsonify(invoice=record.to_dict())


@bp.post("/<int:invoice_id>/reopen")
def reopen(invoice_id):
    record = get_owned(invoice_id)
    if record is None:
        return jsonify(error="not_found"), 404
    if record.status != "ready":
        return jsonify(error="invalid_transition"), 409
    record.status = "draft"
    audit("invoice.review.reopen", record)
    db.session.commit()
    return jsonify(invoice=record.to_dict())


@bp.post("/<int:invoice_id>/simulate-transfer")
def simulate_transfer(invoice_id):
    record = get_owned(invoice_id)
    if record is None:
        return jsonify(error="not_found"), 404
    if record.status != "ready":
        return jsonify(error="invalid_transition"), 409
    record.status = "simulated"
    audit("invoice.transfer.simulated", record)
    db.session.commit()
    return jsonify(invoice=record.to_dict(), message="DEMO: dış servise veri gönderilmedi.")
