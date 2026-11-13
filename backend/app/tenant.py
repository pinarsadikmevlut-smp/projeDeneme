"""Defense-in-depth for all ORM Customer reads and unit-of-work mutations.

Only user-scoped models use this hook. Internal global market data and audit
records are not tenant-owned. Raw SQL / engine.execute are *not* protected by
ORM hooks; never expose them in user data endpoints.
"""
from flask import g, has_request_context
from sqlalchemy import event
from sqlalchemy.orm import Session, with_loader_criteria

from .customers import Customer


@event.listens_for(Session, "do_orm_execute")
def scope_customer_reads(state):
    if not state.is_select or not has_request_context():
        return
    current = getattr(g, "current_user", None)
    if current is None:
        return
    owner_id = current.id
    state.statement = state.statement.options(
        with_loader_criteria(Customer, lambda cls: cls.owner_id == owner_id,
                             include_aliases=True)
    )


@event.listens_for(Session, "before_flush")
def enforce_customer_ownership(session, flush_context, instances):
    if not has_request_context():
        return
    current = getattr(g, "current_user", None)
    for row in (*session.new, *session.dirty, *session.deleted):
        if isinstance(row, Customer) and (current is None or row.owner_id != current.id):
            raise PermissionError("Customer ownership violation")
