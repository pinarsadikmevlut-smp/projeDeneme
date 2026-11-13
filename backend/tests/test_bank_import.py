"""Security and functional regression tests for bank -> unverified draft batches."""
import pytest
from app import AuditEvent, create_app, db
from app.auth import FAILURES, FAILURES_LOCK
from app.customers import Customer
from app.invoices import InvoiceDraft
from app.bank_import import BankImportKey

CONFIG={"TESTING":True,"SQLALCHEMY_DATABASE_URI":"sqlite://",
        "JWT_SECRET_KEY":"testing-batch-drafts-jwt-secret-very-long-1234",
        "SESSION_COOKIE_SECURE":False}
TCKN="10000000146"

@pytest.fixture()
def setup():
    with FAILURES_LOCK:
        FAILURES.clear()
    app=create_app(CONFIG)
    with app.app_context():
        db.create_all()
    with app.test_client() as client:
        yield app,client
    with app.app_context():
        db.session.remove()
        db.drop_all()

def register(client,username):
    login=client.post("/api/auth/register",json={
        "username":username,"password":"test-strong-password-123456"})
    assert login.status_code==201,login.json
    return login.json["user"]["id"],{"X-CSRF-Token":login.json["csrfToken"]}

def customer(client,csrf):
    created=client.post("/api/customers",headers=csrf,json={
        "fullName":"Örnek Müşteri","tckn":TCKN})
    assert created.status_code==201,created.json
    return created.json["customer"]["id"]

def bank_row(key=1,**overrides):
    data={"rowId":key,"reference":f"TEST-FAST-{key}","date":"13.11.2026 12:29",
          "direction":"in","amount":"2500.00","tckn":TCKN,"vkn":""}
    return {**data,**overrides}

def upload(client,csrf,records,template="altin_satis_arsiv"):
    return client.post("/api/invoices/bank-import",headers=csrf,json={
        "templateId":template,"records":records})

def test_requires_login_csrf_and_template(setup):
    _,client=setup
    assert client.get("/api/invoices/templates").status_code==401
    assert client.post("/api/invoices/bank-import",json={}).status_code==401
    owner,csrf=register(client,"batchuser")
    templates=client.get("/api/invoices/templates")
    assert templates.status_code==200
    assert {t["id"] for t in templates.json["templates"]}>={"altin_satis_arsiv","hurda_alimi","sarrafiye_satis"}
    assert client.post("/api/invoices/bank-import",json={
        "templateId":"altin_satis_arsiv","records":[bank_row()]}).status_code==403
    assert client.post("/api/invoices/bank-import",headers=csrf,json={
        "templateId":"made-up","records":[bank_row()]}).status_code==400
    assert client.post("/api/invoices/bank-import",headers=csrf,json={
        "templateId":"altin_satis_arsiv","records":[]}).status_code==400
    assert upload(client,csrf,[bank_row()]).json["results"][0]["reason"]=="customer_not_found"

def test_bulk_import_is_persistent_review_gated_and_idempotent(setup):
    app,client=setup
    owner,csrf=register(client,"batchowner")
    customer(client,csrf)
    rows=[bank_row(1),bank_row(2,reference="TEST-FAST-2",amount="750.00")]
    result=upload(client,csrf,rows)
    assert result.status_code==200,result.json
    assert result.json["created"]==2
    assert result.json["skipped"]==0
    assert not result.json["officialDocument"] and not result.json["transmitted"]
    first=result.json["results"][0]["invoiceId"]
    with app.app_context():
        row=db.session.get(InvoiceDraft,first)
        assert row.owner_id==owner
        assert row.net_total==2500
        assert row.source=="bank_excel"
        assert row.document_type=="e-arsiv"
        assert row.lines[0]["requiresReview"] is True
        assert row.lines[0]["weightGram"]=="0"
        assert row.fine_gram_total==0
        assert db.session.scalar(db.select(db.func.count()).select_from(BankImportKey))==2
        events=db.session.scalars(db.select(AuditEvent).where(AuditEvent.action=="bank.draft.import")).all()
        assert len(events)==2
        assert all(TCKN not in str(event.details) for event in events)
    assert client.post(f"/api/invoices/{first}/review",headers=csrf).status_code==409
    # Full edit requires actual product data; placeholder cannot pass through a PATCH.
    original=client.get(f"/api/invoices/{first}").json["invoice"]
    patch={
        "customerId":original["customerId"],"documentType":original["documentType"],
        "paymentMethod":original["paymentMethod"],"bankReference":original["bankReference"],
        "lines":original["lines"]
    }
    assert client.patch(f"/api/invoices/{first}",headers=csrf,json=patch).status_code==400
    patch["lines"]=[{
        "name":"22 Ayar Bilezik","karat":"22","fineness":"0.916",
        "unit":"gram","weightGram":"1.000","quantity":1,
        "unitPrice":"2500.00","workmanship":"0"
    }]
    assert client.patch(f"/api/invoices/{first}",headers=csrf,json=patch).status_code==200
    assert client.post(f"/api/invoices/{first}/review",headers=csrf).status_code==200
    same=upload(client,csrf,rows,template="gelen_odeme")
    assert same.json["created"]==0 and same.json["skipped"]==2
    assert all(r["reason"]=="already_imported" for r in same.json["results"])
    with app.app_context():
        assert db.session.scalar(db.select(db.func.count()).select_from(InvoiceDraft))==2

def test_gider_pusulasi_mapped_to_outgoing_and_invalid_rows_skipped(setup):
    _,client=setup
    _,csrf=register(client,"batchvoucher")
    customer(client,csrf)
    result=upload(client,csrf,[
        bank_row(1,direction="out"),
        bank_row(2,direction="in"),
        bank_row(3,direction="out",tckn="",vkn="1234567890"),
        bank_row(4,direction="out",reference=""),
        bank_row(5,direction="out",amount="-50.00"),
        bank_row(6,direction="out",tckn="123"),
        bank_row(7,direction="out",amount="125.35")
    ],template="hurda_alimi")
    assert result.status_code==200,result.json
    assert result.json["created"]==2
    assert result.json["skipped"]==5
    assert [r["reason"] for r in result.json["results"] if r["status"]=="skipped"]==[
        "direction_mismatch","corporate_customer_unavailable","missing_reference",
        "invalid_amount","invalid_identity"
    ]
    ids=[r["invoiceId"] for r in result.json["results"] if r["status"]=="created"]
    assert all(client.get(f"/api/invoices/{i}").json["invoice"]["documentType"]=="g-pusulasi" for i in ids)

def test_tenant_isolation_and_no_cross_owner_customer_matching(setup):
    app,client=setup
    user1,csrf1=register(client,"bankowner1")
    customer(client,csrf1)
    first=upload(client,csrf1,[bank_row()]).json["results"][0]["invoiceId"]
    user2,csrf2=register(client,"bankowner2")
    assert client.get("/api/invoices").json["total"]==0
    assert client.get(f"/api/invoices/{first}").status_code==404
    refused=upload(client,csrf2,[bank_row()])
    assert refused.json["created"]==0
    assert refused.json["results"][0]["reason"]=="customer_not_found"
    customer(client,csrf2)
    own=upload(client,csrf2,[bank_row()])
    assert own.json["created"]==1
    assert own.json["results"][0]["invoiceId"]!=first
    with app.app_context():
        records=db.session.scalars(db.select(InvoiceDraft)).all()
        assert {r.owner_id for r in records}=={user1,user2}

@pytest.mark.parametrize("bad",[
    {"amount":"NaN"},{"amount":True},{"amount":"100.999"},{"amount":"1000000000"},
    {"direction":"unknown"},{"date":""},{"tckn":"00000000000"}
])
def test_rejects_untrusted_bank_fields(setup,bad):
    _,client=setup
    _,csrf=register(client,"invalidbatch")
    customer(client,csrf)
    result=upload(client,csrf,[bank_row(**bad)])
    assert result.status_code==200,result.json
    assert result.json["created"]==0
    assert result.json["results"][0]["status"]=="skipped"
