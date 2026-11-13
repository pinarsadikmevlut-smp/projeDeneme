"""Defense-in-depth for all ORM Customer reads and unit-of-work mutations.

Only user-scoped models use this hook. Internal global market data and audit
records are not tenant-owned. Raw SQL / engine.execute are *not* protected by
ORM hooks; never expose them in user data endpoints.
"""
from flask import g, has_request_context
from sqlalchemy import event
from sqlalchemy.orm import Session, with_loader_criteria

from .customers import Customer
from .invoices import InvoiceDraft


@event.listens_for(Session, "do_orm_execute")
def scope_customer_reads(state):
    if not has_request_context():
        return
    owner_id = getattr(g, "current_user_id", None)
    if owner_id is None:
        return
    if state.is_select:
        state.statement = state.statement.options(
            with_loader_criteria(Customer, lambda cls: cls.owner_id == owner_id, include_aliases=True),
            with_loader_criteria(InvoiceDraft, lambda cls: cls.owner_id == owner_id, include_aliases=True)
        )
    elif state.is_update or state.is_delete:
        # ORM bulk writes skip before_flush. Constrain them, too.
        mapper = state.bind_arguments.get("mapper")
        if mapper is not None and mapper.class_ in (Customer, InvoiceDraft):
            state.statement = state.statement.where(mapper.class_.owner_id == owner_id)


@event.listens_for(Session, "before_flush")
def enforce_customer_ownership(session, flush_context, instances):
    if not has_request_context():
        return
    owner_id = getattr(g, "current_user_id", None)
    for row in (*session.new, *session.dirty, *session.deleted):
        if isinstance(row, (Customer, InvoiceDraft)) and (owner_id is None or row.owner_id != owner_id):
            raise PermissionError("Tenant ownership violation")
