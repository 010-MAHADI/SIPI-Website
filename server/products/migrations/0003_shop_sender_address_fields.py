from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0002_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="shop",
            name="sender_mobile_no",
            field=models.CharField(blank=True, max_length=20, null=True),
        ),
        migrations.AddField(
            model_name="shop",
            name="sender_name",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name="shop",
            name="sender_post_code",
            field=models.CharField(blank=True, max_length=20, null=True),
        ),
        migrations.AddField(
            model_name="shop",
            name="sender_post_office",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name="shop",
            name="sender_upazila",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name="shop",
            name="sender_village",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name="shop",
            name="sender_zilla",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
    ]
