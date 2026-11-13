from app import create_app, db, AuditEvent, record_audit

CONFIG={"TESTING":True,"SQLALCHEMY_DATABASE_URI":"sqlite://",
        "JWT_SECRET_KEY":"test-security-signing-key-long-enough-123456"}

def client():
    app=create_app(CONFIG)
    return app,app.test_client()

def test_anonymous_session():
    app,c=client()
    result=c.get("/api/auth/session")
    assert result.status_code==200
    assert result.json=={"authenticated":False,"user":None,"permissions":[]}
    assert result.headers["Cache-Control"]=="no-store"
    assert result.headers["X-Frame-Options"]=="DENY"

def test_secure_cookie_defaults():
    app,_=client()
    assert app.config["SESSION_COOKIE_HTTPONLY"] is True
    assert app.config["SESSION_COOKIE_SAMESITE"]=="Strict"
    assert app.config["SESSION_COOKIE_SECURE"] is True

def test_audit_record_is_persisted():
    app,_=client()
    with app.app_context():
        db.create_all()
        record_audit("user-1","margin.update","gram",{"old":1,"new":2})
        event=db.session.execute(db.select(AuditEvent)).scalar_one()
        assert event.actor_id=="user-1"
        assert event.details["new"]==2

def test_connection_is_protected():
    app,c=client()
    assert c.get("/api/connection").status_code==401
    with app.app_context():
        db.create_all()
    r=c.post("/api/auth/register",json={
       "username":"security","password":"very-secure-password-123"})
    assert r.status_code==201
    assert c.get("/api/connection").json["source"]=="simulation"
