from django.db import models

class Report(models.Model):
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('Validated', 'Validated'),
        ('Rejected', 'Rejected'),
        ('Resolved', 'Resolved'),
    ]

    violation_type = models.CharField(max_length=100)
    description = models.TextField()
    image = models.ImageField(upload_to='reports/')
    location = models.CharField(max_length=255)
    date_reported = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Pending')

    def __str__(self):
        return self.violation_type