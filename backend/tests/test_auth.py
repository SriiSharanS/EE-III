import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

backend_dir = Path(__file__).resolve().parents[1]
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import main


class AuthenticationEndpointTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.TemporaryDirectory()
        cls.auth_db_path = Path(cls.temp_dir.name) / "auth.db"
        cls.db_path_patch = patch.object(main, "get_auth_db_path", return_value=cls.auth_db_path)
        cls.db_path_patch.start()
        main.init_auth_db()
        cls.client = TestClient(main.app)

    @classmethod
    def tearDownClass(cls):
        cls.db_path_patch.stop()
        cls.temp_dir.cleanup()

    def test_registration_creates_hashed_password_and_login_survives_reinitialization(self):
        registration = self.client.post(
            "/api/auth/register",
            json={"email": "Candidate@Example.org", "password": "own-password"},
        )

        self.assertEqual(registration.status_code, 200)
        self.assertTrue(registration.json()["success"])
        self.assertEqual(registration.json()["user"]["email"], "candidate@example.org")

        import sqlite3

        conn = sqlite3.connect(self.auth_db_path)
        try:
            stored_password = conn.execute(
                "SELECT password FROM users WHERE email = ?",
                ("candidate@example.org",),
            ).fetchone()[0]
        finally:
            conn.close()
        self.assertTrue(stored_password.startswith(main.PASSWORD_HASH_PREFIX))
        self.assertNotEqual(stored_password, "own-password")

        main.init_auth_db()
        login = self.client.post(
            "/api/auth/login",
            json={"email": "candidate@example.org", "password": "own-password"},
        )
        self.assertEqual(login.status_code, 200)
        self.assertTrue(login.json()["success"])

    def test_registration_rejects_duplicate_email_and_short_password(self):
        self.client.post(
            "/api/auth/register",
            json={"email": "duplicate@example.org", "password": "secure-pass"},
        )
        duplicate = self.client.post(
            "/api/auth/register",
            json={"email": "DUPLICATE@example.org", "password": "another-pass"},
        )
        short_password = self.client.post(
            "/api/auth/register",
            json={"email": "short@example.org", "password": "123"},
        )

        self.assertFalse(duplicate.json()["success"])
        self.assertEqual(short_password.status_code, 400)

    def test_registration_rejects_invalid_email(self):
        response = self.client.post(
            "/api/auth/register",
            json={"email": "not-an-email", "password": "secure-pass"},
        )

        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
