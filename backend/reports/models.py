import random
from django.db import models

class Report(models.Model):
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Validated', 'Validated'),
        ('Assigned', 'Assigned'),
        ('In Progress', 'In Progress'),
        ('Rejected', 'Rejected'),
        ('Resolved', 'Resolved'),
    ]

    reference_id = models.CharField(max_length=32, unique=True, null=True, blank=True, editable=False)
    violation_type = models.CharField(max_length=100)
    description = models.TextField()
    image = models.FileField(upload_to='reports/')
    location = models.CharField(max_length=255)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    assigned_officer = models.CharField(max_length=120, blank=True, default='')
    date_reported = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')

    @classmethod
    def generate_reference_id(cls):
        while True:
            candidate = f"SUP-{random.randint(10_000_000, 99_999_999)}"
            if not cls.objects.filter(reference_id=candidate).exists():
                return candidate

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)

        if is_new and not self.reference_id:
            self.reference_id = self.generate_reference_id()
            super().save(update_fields=["reference_id"])

    def __str__(self):
        return self.reference_id or self.violation_type
