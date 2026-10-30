from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from .models import AdminActivity, Officer, Report


@override_settings(SECURE_SSL_REDIRECT=False)
class OfficerTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.staff = User.objects.create_user('officer_manager', is_staff=True)
        self.client.force_authenticate(self.staff)
        self.officer = Officer.objects.get(name='Officer Santos')
        self.path = f'/api/admin/officers/{self.officer.pk}/'

    def report(self, status='Assigned'):
        return Report.objects.create(violation_type='Obstruction', description='Test', location='Surigao',
            reporter_email='citizen@example.com', image='reports/test.jpg', status=status,
            assigned_officer=self.officer.name)

    def test_create_list_edit_and_delete_persist(self):
        response = self.client.post('/api/admin/officers/', {'name': 'Officer Garcia', 'badge': 'CTMO-900', 'unit': 'Patrol'})
        self.assertEqual(response.status_code, 201, response.data)
        path = f'/api/admin/officers/{response.data["id"]}/'
        self.assertEqual(self.client.patch(path, {'unit': 'Traffic Unit'}).status_code, 200)
        self.assertEqual(Officer.objects.get(pk=response.data['id']).unit, 'Traffic Unit')
        self.assertIn('Officer Garcia', [row['name'] for row in self.client.get('/api/admin/officers/').data])
        self.assertEqual(self.client.delete(path).status_code, 204)
        self.assertFalse(Officer.objects.filter(pk=response.data['id']).exists())

    def test_duplicate_names_badges_and_empty_fields_rejected(self):
        for data in [
            {'name': 'officer santos', 'badge': 'NEW-1', 'unit': 'Patrol'},
            {'name': 'Different', 'badge': self.officer.badge.lower(), 'unit': 'Patrol'},
            {'name': '  ', 'badge': 'NEW-1', 'unit': 'Patrol'},
        ]:
            self.assertEqual(self.client.post('/api/admin/officers/', data).status_code, 400)

    def test_rename_preserves_assignments_and_logs_change(self):
        report = self.report()
        self.assertEqual(self.client.patch(self.path, {'name': 'Officer Santos Jr.'}).status_code, 200)
        report.refresh_from_db()
        self.assertEqual(report.assigned_officer, 'Officer Santos Jr.')
        self.assertEqual(AdminActivity.objects.get(report=report).changes['assigned_officer']['before'], 'Officer Santos')

    def test_active_assignment_blocks_delete_but_closed_history_is_kept(self):
        report = self.report()
        self.assertEqual(self.client.delete(self.path).status_code, 409)
        self.assertTrue(Officer.objects.filter(pk=self.officer.pk).exists())
        report.status = 'Resolved'
        report.save(update_fields=['status'])
        self.assertEqual(self.client.delete(self.path).status_code, 204)
        report.refresh_from_db()
        self.assertEqual(report.assigned_officer, 'Officer Santos')

    def test_missing_officer_cannot_receive_a_new_case(self):
        report = self.report()
        report.assigned_officer = ''
        report.save(update_fields=['assigned_officer'])
        response = self.client.patch(f'/api/reports/{report.pk}/', {'assigned_officer': 'Removed Officer'})
        self.assertEqual(response.status_code, 400)

    def test_citizens_cannot_read_or_change_directory(self):
        self.client.force_authenticate(User.objects.create_user('citizen'))
        self.assertEqual(self.client.get('/api/admin/officers/').status_code, 403)
        self.assertEqual(self.client.post('/api/admin/officers/', {}).status_code, 403)
        self.assertEqual(self.client.patch(self.path, {'name': 'Changed'}).status_code, 403)
        self.assertEqual(self.client.delete(self.path).status_code, 403)
