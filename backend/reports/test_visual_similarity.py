import random
from datetime import timedelta
from io import BytesIO
from unittest.mock import patch

from PIL import Image, ImageDraw
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

from .visual_similarity import visual_fingerprint, visually_similar
from .test_duplicates import DuplicateReportFixtures
from .models import Report, ReportDuplicateMatch


def street_scene(seed=42):
    image = Image.new("RGB", (480, 360), "#c6e3f5")
    draw = ImageDraw.Draw(image)
    generator = random.Random(seed)
    for _ in range(65):
        x, y = generator.randrange(450), generator.randrange(320)
        width, height = generator.randrange(10, 55), generator.randrange(10, 60)
        color = tuple(generator.randrange(25, 225) for _ in range(3))
        draw.rectangle((x, y, x + width, y + height), fill=color)
    draw.polygon([(180, 140), (270, 140), (420, 360), (20, 360)], fill="#65717e")
    for y in range(180, 360, 45):
        draw.rectangle((215, y, 224, y + 20), fill="white")
    draw.rectangle((260, 230, 350, 285), fill="#236daa")
    draw.ellipse((270, 270, 293, 293), fill="#172d42")
    draw.ellipse((319, 270, 342, 293), fill="#172d42")
    return image


def image_bytes(image, format="JPEG", **options):
    output = BytesIO()
    image.save(output, format=format, **options)
    return output.getvalue()


def signature(image, **options):
    return visual_fingerprint(SimpleUploadedFile("evidence.jpg", image_bytes(image, **options)))


class VisualDuplicateTests(DuplicateReportFixtures, TestCase):
    def test_resized_and_recompressed_images_match_without_exact_bytes(self):
        original = street_scene()
        first = self.create_report(content=image_bytes(original, quality=95))
        second = self.create_report(content=image_bytes(original.resize((240, 180)), quality=45), filename="smaller.jpg")
        self.assertNotEqual(first.evidence_sha256, second.evidence_sha256)
        self.assertEqual(ReportDuplicateMatch.objects.get().match_type, "visual")
        self.assertEqual(Report.objects.count(), 2)

    def test_center_corner_and_one_sided_crops_match_in_both_directions(self):
        original = street_scene()
        baseline = signature(original)
        for crop in ((48, 36, 432, 324), (0, 0, 384, 288), (48, 0, 480, 360), (0, 36, 480, 360)):
            with self.subTest(crop=crop):
                cropped = signature(original.crop(crop), quality=75)
                self.assertTrue(visually_similar(baseline, cropped))
                self.assertTrue(visually_similar(cropped, baseline))

    def test_different_photos_and_flat_backgrounds_do_not_match(self):
        first, second = street_scene(), street_scene(seed=421)
        self.assertFalse(visually_similar(signature(first), signature(second)))
        flat = signature(Image.new("RGB", (480, 360), "gray"))
        self.assertFalse(visually_similar(flat, flat))

    def test_visual_match_still_requires_violation_location_and_time(self):
        original = street_scene()
        self.create_report(content=image_bytes(original))
        resized = image_bytes(original.resize((240, 180)), quality=65)
        self.create_report(content=resized, violation_type="No U-Turn / Illegal Turn")
        self.create_report(content=resized, latitude="9.795000")
        self.create_report(content=resized, occurred_at=self.event_time + timedelta(hours=2))
        self.assertFalse(ReportDuplicateMatch.objects.exists())

    def test_exif_rotation_and_format_conversion_match(self):
        original = street_scene()
        rotated = original.transpose(Image.Transpose.ROTATE_90)
        exif = Image.Exif()
        exif[274] = 6
        upload = SimpleUploadedFile("rotated.jpg", image_bytes(rotated, exif=exif))
        self.assertTrue(visually_similar(signature(original, format="PNG"), visual_fingerprint(upload)))

    def test_invalid_video_or_oversized_image_does_not_break_upload_stream(self):
        invalid = SimpleUploadedFile("video.mp4", b"not a decodable image")
        invalid.seek(4)
        self.assertEqual(visual_fingerprint(invalid), {})
        self.assertEqual(invalid.tell(), 4)
        valid = SimpleUploadedFile("image.jpg", image_bytes(street_scene()))
        valid.seek(5)
        visual_fingerprint(valid)
        self.assertEqual(valid.tell(), 5)
        self.assertFalse(valid.closed)
        with patch("reports.visual_similarity.MAX_VISUAL_PIXELS", 10):
            self.assertEqual(visual_fingerprint(valid), {})
