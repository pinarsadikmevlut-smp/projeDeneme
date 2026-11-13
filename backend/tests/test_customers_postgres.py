"""PostgreSQL integration checks use disposable CI database only."""
import os
import pytest

from app import create_app, db
from app.auth import User
from app.customers import Customer

pytestmark = pytest.mark.skipif(
 not (os.getenv("POSTGRES_INTEGRATION_URL") and os.getenv("CUSTOMER_CI_ISOLATED_DB") == "1"),
 reason="requires explicitly disposable PostgreSQL CI database",
)
CFG = {"TESTING": True, "JWT_SECRET_KEY": "test-postgres-jwt-secret-long-enough-1234",
       "SESSION_COOKIE_SECURE": False}

def test_postgres_user_ownership_and_persistence():
 app = create_app({**CFG,"SQLALCHEMY_DATABASE_URI":os.environ["POSTGRES_INTEGRATION_URL"]})
 with app.app_context():
  assert db.engine.dialect.name == "postgresql"
  db.create_all()
 with app.test_client() as client:
  first=client.post("/api/auth/register",json={
   "username":"ci-one","password":"long-secure-password-12345"})
  assert first.status_code==201
  hdr={"X-CSRF-Token":first.json["csrfToken"]}
  customer={"fullName":"Ayşe Kaya","tckn":"10000000146"}
  r=client.post("/api/customers",json=customer,headers=hdr)
  assert r.status_code==201
  ident=r.json["customer"]["id"]
  second=client.post("/api/auth/register",json={
   "username":"ci-two","password":"long-secure-password-12345"})
  assert second.status_code==201
  hdr2={"X-CSRF-Token":second.json["csrfToken"]}
  assert client.get("/api/customers").json["total"]==0
  assert client.patch(f"/api/customers/{ident}",json={"fullName":"Başka İsim"},headers=hdr2).status_code==404
  assert client.post("/api/customers",json=customer,headers=hdr2).status_code==201
  assert client.get("/api/customers").json["total"]==1
 # Reconnect using fresh Flask instance: owned records persist.
 app2=create_app({**CFG,"SQLALCHEMY_DATABASE_URI":os.environ["POSTGRES_INTEGRATION_URL"]})
 with app2.test_client() as client:
  logged=client.post("/api/auth/login",json={"username":"ci-one","password":"long-secure-password-12345"})
  assert logged.status_code==200
  assert client.get("/api/customers").json["total"]==1
  assert client.get("/api/customers").json["customers"][0]["id"]==ident
