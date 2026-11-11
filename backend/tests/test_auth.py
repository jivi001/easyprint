from fastapi import status


def test_student_registration_success(client):
    payload = {
        "email": "newstudent@college.edu",
        "password": "SecurePassword123!",
        "name": "David Student",
        "role": "student"
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["email"] == "newstudent@college.edu"
    assert data["name"] == "David Student"
    assert data["role"] == "student"
    assert "password_hash" not in data


def test_registration_duplicate_email(client, student_user):
    payload = {
        "email": student_user.email,
        "password": "Password123!",
        "name": "Imposter",
        "role": "student"
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "already exists" in response.json()["detail"]["message"]


def test_login_success(client, student_user):
    payload = {
        "email": student_user.email,
        "password": "Password123!"
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "access_token" in data
    assert data["role"] == "student"
    assert data["email"] == student_user.email


def test_login_invalid_password(client, student_user):
    payload = {
        "email": student_user.email,
        "password": "WrongPassword!"
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert "Invalid email or password" in response.json()["detail"]["message"]


def test_get_current_user_profile(client, student_auth_header, student_user):
    response = client.get("/api/v1/users/me", headers=student_auth_header)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["id"] == str(student_user.id)
    assert data["email"] == student_user.email


def test_unauthorized_without_token(client):
    response = client.get("/api/v1/users/me")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
