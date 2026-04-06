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

    violation_type = models.CharField(max_length=100)
    description = models.TextField()
    image = models.FileField(upload_to='reports/')
    location = models.CharField(max_length=255)
    assigned_officer = models.CharField(max_length=120, blank=True, default='')
    date_reported = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')

    def __str__(self):
        return self.violation_type
