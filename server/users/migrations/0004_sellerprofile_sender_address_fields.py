from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0003_customerprofile_address"),
    ]

    operations = [
        migrations.AddField(
            model_name="sellerprofile",
            name="mobile_no",
            field=models.CharField(blank=True, max_length=20, null=True),
        ),
        migrations.AddField(
            model_name="sellerprofile",
            name="post_code",
            field=models.CharField(blank=True, max_length=20, null=True),
        ),
        migrations.AddField(
            model_name="sellerprofile",
            name="post_office",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name="sellerprofile",
            name="sender_name",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name="sellerprofile",
            name="upazila",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name="sellerprofile",
            name="village",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name="sellerprofile",
            name="zilla",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
    ]
