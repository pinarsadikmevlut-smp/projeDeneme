"""Bulk bank-statement conversion to *unverified* user-owned invoice drafts.

No real invoices, receipts or Mysoft/GIB submissions occur. A bank deposit
alone cannot establish the sold goods, tax basis, or customer identity.
"""
import hashlib
import re
from decimal import Decimal, InvalidOperation
from flask import Blueprint, g, jsonify, request
from sqlalchemy.exc import IntegrityError

from . import db, AuditEvent
from .customers import Customer, valid_tckn
from .invoices import InvoiceDraft, MONEY

bp = Blueprint("bank_draft_import", __name__, url_prefix="/api/invoices")

# Public descriptors contain no tax rates or legal conclusions. They are
# configurable static application templates; client loads them through API.
TEMPLATES = (
    {"id": "altin_satis_arsiv", "label": "Altın Satışı", "subtitle": "e-Arşiv taslağı",
     "documentType": "e-arsiv", "directions": ["in"], "category": "satis"},
    {"id": "altin_satis_efatura", "label": "Altın Satışı", "subtitle": "e-Fatura taslağı",
     "documentType": "e-fatura", "directions": ["in"], "category": "satis"},
    {"id": "sarrafiye_satis", "label": "Sarrafiye Satışı", "subtitle": "e-Arşiv taslağı",
     "documentType": "e-arsiv", "directions": ["in"], "category": "satis"},
    {"id": "hurda_alimi", "label": "Hurda Alımı", "subtitle": "Gider pusulası taslağı",
     "documentType": "g-pusulasi", "directions": ["out"], "category": "alim"},
    {"id": "gelen_odeme", "label": "Gelen Ödeme / Diğer", "subtitle": "e-Arşiv taslağı",
     "documentType": "e-arsiv", "directions": ["in"], "category": "diger"},
    {"id": "giden_odeme", "label": "Giden Ödeme / Diğer", "subtitle": "Gider pusulası taslağı",
     "documentType": "g-pusulasi", "directions": ["out"], "category": "diger"},
)
BY_ID = {item["id"]: item for item in TEMPLATES}


class BankImportKey(db.Model):
    """Atomic duplicate guard for one user's imported bank transaction."""
    __tablename__ = "user_bank_draft_import_keys"
    id = db.Column(db.Integer, primary_key=True)
    owner_id = db.Column(db.Integer, db.ForeignKey("app_users.id"), nullable=False, index=True)
    row_digest = db.Column(db.String(64), nullable=False)
    invoice_id = db.Column(db.Integer, db.ForeignKey("user_invoice_drafts.id"), nullable=False)
    __table_args__ = (db.UniqueConstraint("owner_id", "row_digest",
                                          name="uq_bank_import_owner_digest"),)


@bp.get("/templates")
def list_templates():
    return jsonify(templates=list(TEMPLATES))


def validate(row, template):
    if not isinstance(row, dict):
        return None, "invalid_row"
    reference = row.get("reference")
    date = row.get("date")
    direction = row.get("direction")
    tckn = row.get("tckn")
    vkn = row.get("vkn")
    if not isinstance(reference, str) or not 1 <= len(reference.strip()) <= 80:
        return None, "missing_reference"
    if not isinstance(date, str) or not 6 <= len(date.strip()) <= 40:
        return None, "invalid_date"
    if direction not in template["directions"]:
        return None, "direction_mismatch"
    if not isinstance(tckn, str) or not valid_tckn(tckn):
        if isinstance(vkn, str) and re.fullmatch(r"\d{10}", vkn):
            return None, "corporate_customer_unavailable"
        return None, "invalid_identity"
    try:
        raw_amount = row.get("amount")
        if isinstance(raw_amount, bool) or not isinstance(raw_amount, (int, float, str)):
            return None, "invalid_amount"
        amount = Decimal(str(raw_amount))
        if not amount.is_finite() or amount <= 0 or amount > Decimal("100000000"):
            return None, "invalid_amount"
        if amount.as_tuple().exponent < -2:
            return None, "invalid_amount"
        amount = amount.quantize(MONEY)
    except (ValueError, InvalidOperation):
        return None, "invalid_amount"
    return {"reference": reference.strip(), "date": date.strip(),
            "direction": direction, "tckn": tckn, "amount": amount}, None


def hashed_key(entry):
    # No TCKN or bank description retained in the unique-key table.
    key = "|".join((entry["reference"].casefold(), entry["date"],
                    entry["direction"], str(entry["amount"])))
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


@bp.post("/bank-import")
def batch_bank_import():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify(error="invalid_payload"), 400
    template = BY_ID.get(payload.get("templateId")) if isinstance(payload.get("templateId"), str) else None
    if template is None:
        return jsonify(error="template_required", message="Geçerli bir şablon seçin."), 400
    records = payload.get("records")
    if not isinstance(records, list) or not 1 <= len(records) <= 25:
        return jsonify(error="invalid_records", message="Bir defada 1-25 hareket gönderilebilir."), 400

    output = []
    created = 0
    for index, row in enumerate(records):
        # Only a small opaque row key is echoed, never a raw person or identity.
        row_id = row.get("rowId") if isinstance(row, dict) else None
        row_id = row_id if type(row_id) is int and 0 < row_id <= 1000000 else index + 1
        entry, problem = validate(row, template)
        if problem:
            output.append({"rowId": row_id, "status": "skipped", "reason": problem})
            continue
        customer = db.session.scalar(db.select(Customer).where(
            Customer.owner_id == g.current_user_id,
            Customer.tckn == entry["tckn"]
        ))
        if customer is None:
            output.append({"rowId": row_id, "status": "skipped",
                           "reason": "customer_not_found"})
            continue
        digest = hashed_key(entry)
        present = db.session.scalar(db.select(BankImportKey.id).where(
            BankImportKey.owner_id == g.current_user_id,
            BankImportKey.row_digest == digest
        ))
        if present:
            output.append({"rowId": row_id, "status": "skipped", "reason": "already_imported"})
            continue
        # No fabricated grams, fineness or VAT. The amount is the bank amount,
        # not a validated price; a reviewer must replace this placeholder.
        label = template["label"] + " — ürün/hizmet doğrulanacak"
        lines = [{
            "name": label, "karat": "diger", "unit": "adet", "fineness": "0",
            "quantity": 1, "weightGram": "0", "unitPrice": str(entry["amount"]),
            "workmanship": "0", "amount": str(entry["amount"]),
            "requiresReview": True
        }]
        record = InvoiceDraft(
            owner_id=g.current_user_id, customer_id=customer.id,
            document_type=template["documentType"], payment_method="Havale / EFT",
            status="draft", source="bank_excel",
            bank_reference=entry["reference"],
            notes="Banka taslağı: ürün/hizmet, belge ve vergi bilgileri doğrulanmalı.",
            lines=lines, net_total=entry["amount"], fine_gram_total=Decimal("0")
        )
        try:
            # savepoint allows partial success if duplicate is created concurrently.
            with db.session.begin_nested():
                db.session.add(record)
                db.session.flush()
                db.session.add(BankImportKey(
                    owner_id=g.current_user_id, row_digest=digest, invoice_id=record.id))
                db.session.flush()
            db.session.add(AuditEvent(
                actor_id=str(g.current_user_id), action="bank.draft.import",
                target=str(record.id), details={"templateId": template["id"]}))
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            output.append({"rowId": row_id, "status": "skipped", "reason": "already_imported"})
            continue
        created += 1
        output.append({"rowId": row_id, "status": "created", "invoiceId": record.id,
                       "reference": "PG-TAS-%06d" % record.id})
    return jsonify(created=created, skipped=len(output)-created, results=output,
                   officialDocument=False, transmitted=False)
