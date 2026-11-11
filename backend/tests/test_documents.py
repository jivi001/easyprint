import io
from fastapi import status


def test_upload_valid_pdf(client, student_auth_header, valid_pdf_bytes):
    files = {"file": ("assignment.pdf", io.BytesIO(valid_pdf_bytes), "application/pdf")}
    response = client.post("/api/v1/documents/upload", headers=student_auth_header, files=files)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert "id" in data
    assert data["file_name"] == "assignment.pdf"
    assert data["file_size"] == len(valid_pdf_bytes)


def test_upload_invalid_non_pdf(client, student_auth_header, invalid_pdf_bytes):
    files = {"file": ("fake.pdf", io.BytesIO(invalid_pdf_bytes), "application/pdf")}
    response = client.post("/api/v1/documents/upload", headers=student_auth_header, files=files)
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "Invalid file signature" in response.json()["detail"]["message"]


def test_upload_prohibited_script_pdf(client, student_auth_header, malicious_script_pdf_bytes):
    files = {"file": ("exploit.pdf", io.BytesIO(malicious_script_pdf_bytes), "application/pdf")}
    response = client.post("/api/v1/documents/upload", headers=student_auth_header, files=files)
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "prohibited active scripting" in response.json()["detail"]["message"]


def test_upload_corrupted_pdf_missing_eof(client, student_auth_header):
    truncated = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n"
    files = {"file": ("corrupt.pdf", io.BytesIO(truncated), "application/pdf")}
    response = client.post("/api/v1/documents/upload", headers=student_auth_header, files=files)
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "Missing terminal %%EOF" in response.json()["detail"]["message"]


def test_download_own_document_success(client, student_auth_header, valid_pdf_bytes):
    # Upload
    files = {"file": ("thesis.pdf", io.BytesIO(valid_pdf_bytes), "application/pdf")}
    upload_res = client.post("/api/v1/documents/upload", headers=student_auth_header, files=files)
    doc_id = upload_res.json()["id"]

    # Download
    dl_res = client.get(f"/api/v1/documents/{doc_id}", headers=student_auth_header)
    assert dl_res.status_code == status.HTTP_200_OK
    assert dl_res.content == valid_pdf_bytes
    assert dl_res.headers["x-content-type-options"] == "nosniff"


def test_idor_protection_cross_student_access_rejected(
    client,
    student_auth_header,
    second_student_auth_header,
    valid_pdf_bytes
):
    # Student 1 uploads
    files = {"file": ("private_notes.pdf", io.BytesIO(valid_pdf_bytes), "application/pdf")}
    upload_res = client.post("/api/v1/documents/upload", headers=student_auth_header, files=files)
    doc_id = upload_res.json()["id"]

    # Student 2 attempts to download Student 1's document -> Must receive 403 Forbidden
    dl_res = client.get(f"/api/v1/documents/{doc_id}", headers=second_student_auth_header)
    assert dl_res.status_code == status.HTTP_403_FORBIDDEN
    assert "Access denied" in dl_res.json()["detail"]


def test_staff_can_access_student_document_for_printing(
    client,
    student_auth_header,
    staff_auth_header,
    valid_pdf_bytes
):
    # Student uploads
    files = {"file": ("lab_report.pdf", io.BytesIO(valid_pdf_bytes), "application/pdf")}
    upload_res = client.post("/api/v1/documents/upload", headers=student_auth_header, files=files)
    doc_id = upload_res.json()["id"]

    # Staff downloads document for printing -> Allowed
    dl_res = client.get(f"/api/v1/documents/{doc_id}", headers=staff_auth_header)
    assert dl_res.status_code == status.HTTP_200_OK
    assert dl_res.content == valid_pdf_bytes
