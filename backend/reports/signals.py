from types import SimpleNamespace

from django.db.models.signals import pre_save, post_save, post_delete
from django.dispatch import receiver

from .models import Report
from .suspicious import SIGNAL_FIELDS, schedule_suspicious_check


@receiver(pre_save, sender=Report)
def remember_report_signals(sender, instance, update_fields=None, **kwargs):
    if kwargs.get("raw"):
        return
    if update_fields is not None and not SIGNAL_FIELDS.intersection(update_fields):
        return
    previous = sender.objects.filter(pk=instance.pk).values(*SIGNAL_FIELDS).first() if instance.pk else None
    instance._previous_signal_values = previous


@receiver(post_save, sender=Report)
def check_report_signals(sender, instance, created, update_fields=None, **kwargs):
    if kwargs.get("raw"):
        return
    # Report.save assigns its reference in a second save. Under autocommit,
    # wait for that save so related-report links never contain a null reference.
    if not instance.reference_id:
        return
    if update_fields is not None and not SIGNAL_FIELDS.intersection(update_fields) and "reference_id" not in update_fields:
        return
    previous = getattr(instance, "_previous_signal_values", None)
    if created or previous is None or any(previous[field] != getattr(instance, field) for field in SIGNAL_FIELDS):
        schedule_suspicious_check(instance, SimpleNamespace(**previous) if previous else None)


@receiver(post_delete, sender=Report)
def refresh_related_report_signals(sender, instance, **kwargs):
    schedule_suspicious_check(instance, instance)
