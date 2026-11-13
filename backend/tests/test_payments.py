import io
import uuid
from fastapi import status


def _upload_test_doc(client, auth_header, valid_pdf_bytes, filename="coursework.pdf"):
    files = {"file": (filename, io.BytesIO(valid_pdf_bytes), "application/pdf")}
    res = client.post("/api/v1/documents/upload", headers=auth_header, files=files)
    return res.json()["id"]


def test_get_payment_rates(client):
    res = client.get("/api/v1/payments/rates")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["bw_rate_per_page"] == 0.10
    assert data["color_rate_per_page"] == 0.50
    assert data["currency"] == "USD"
    assert data["currency_symbol"] == "$"


def test_calculate_payment_pricing(client):
    # 5 pages, 2 copies, B&W -> 5 * 2 * 0.10 = 1.00
    res = client.post(
        "/api/v1/payments/calculate",
        json={"page_range": "1-5", "copies": 2, "color_mode": "bw", "duplex": "single"}
    )
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["total_pages"] == 10
    assert data["rate_per_page"] == 0.10
    assert data["total_amount"] == 1.00

    # 4 pages, 1 copy, Color -> 4 * 1 * 0.50 = 2.00
    res_color = client.post(
        "/api/v1/payments/calculate",
        json={"page_range": "1-4", "copies": 1, "color_mode": "color", "duplex": "double"}
    )
    assert res_color.status_code == status.HTTP_200_OK
    assert res_color.json()["total_amount"] == 2.00


def test_print_request_initializes_unpaid_payment(client, student_auth_header, valid_pdf_bytes):
    doc_id = _upload_test_doc(client, student_auth_header, valid_pdf_bytes)
    res = client.post(
        "/api/v1/print-requests",
        headers=student_auth_header,
        json={"document_id": doc_id, "copies": 2, "color_mode": "bw", "page_range": "1-3"}
    )
    assert res.status_code == status.HTTP_201_CREATED
    data = res.json()
    assert data["payment_status"] == "UNPAID"
    # 3 pages * 2 copies * 0.10 = 0.60
    assert data["total_amount"] == 0.60
    assert data["currency"] == "USD"

    # Query payment detail endpoint
    req_id = data["id"]
    pay_res = client.get(f"/api/v1/payments/request/{req_id}", headers=student_auth_header)
    assert pay_res.status_code == status.HTTP_200_OK
    pay_data = pay_res.json()
    assert pay_data["status"] == "UNPAID"
    assert pay_data["amount"] == 0.60


def test_student_process_card_payment_success(client, student_auth_header, valid_pdf_bytes):
    doc_id = _upload_test_doc(client, student_auth_header, valid_pdf_bytes)
    res = client.post(
        "/api/v1/print-requests",
        headers=student_auth_header,
        json={"document_id": doc_id, "copies": 1, "color_mode": "bw", "page_range": "1-2"}
    )
    req_id = res.json()["id"]

    # Process card payment
    pay_payload = {
        "request_id": req_id,
        "payment_method": "card",
        "card_number": "4242 4242 4242 4242",
        "card_expiry": "12/28",
        "card_cvv": "123",
        "card_holder": "Jane Student"
    }
    pay_res = client.post("/api/v1/payments/process", headers=student_auth_header, json=pay_payload)
    assert pay_res.status_code == status.HTTP_200_OK
    pay_data = pay_res.json()
    assert pay_data["status"] == "COMPLETED"
    assert pay_data["payment_method"] == "card"
    assert pay_data["transaction_id"].startswith("TXN-PE-")
    assert pay_data["receipt_reference"].startswith("RCPT-")
    assert pay_data["paid_at"] is not None

    # Check print request reflects COMPLETED payment
    req_check = client.get(f"/api/v1/print-requests/{req_id}", headers=student_auth_header)
    assert req_check.json()["payment_status"] == "COMPLETED"

    # Get receipt
    rcpt_res = client.get(f"/api/v1/payments/receipt/{req_id}", headers=student_auth_header)
    assert rcpt_res.status_code == status.HTTP_200_OK
    rcpt_data = rcpt_res.json()
    assert rcpt_data["status"] == "COMPLETED"
    assert rcpt_data["amount"] == 0.20
    assert rcpt_data["document_name"] == "coursework.pdf"


def test_student_process_upi_and_campus_wallet(client, student_auth_header, valid_pdf_bytes):
    doc_id = _upload_test_doc(client, student_auth_header, valid_pdf_bytes)
    
    # UPI payment test
    res_upi = client.post(
        "/api/v1/print-requests",
        headers=student_auth_header,
        json={"document_id": doc_id, "copies": 1, "color_mode": "color", "page_range": "1"}
    )
    req_id_upi = res_upi.json()["id"]
    pay_upi = client.post(
        "/api/v1/payments/process",
        headers=student_auth_header,
        json={"request_id": req_id_upi, "payment_method": "upi", "upi_id": "student@okaxis"}
    )
    assert pay_upi.status_code == status.HTTP_200_OK
    assert pay_upi.json()["status"] == "COMPLETED"
    assert pay_upi.json()["payment_method"] == "upi"

    # Campus wallet payment test
    res_cw = client.post(
        "/api/v1/print-requests",
        headers=student_auth_header,
        json={"document_id": doc_id, "copies": 1, "color_mode": "bw", "page_range": "1-5"}
    )
    req_id_cw = res_cw.json()["id"]
    pay_cw = client.post(
        "/api/v1/payments/process",
        headers=student_auth_header,
        json={"request_id": req_id_cw, "payment_method": "campus_wallet", "campus_id": "STU-99214"}
    )
    assert pay_cw.status_code == status.HTTP_200_OK
    assert pay_cw.json()["status"] == "COMPLETED"
    assert pay_cw.json()["payment_method"] == "campus_wallet"


def test_payment_idor_prevention(client, student_auth_header, valid_pdf_bytes):
    """Ensure another student cannot pay for or access someone else's payment receipt."""
    # Register second student
    client.post(
        "/api/v1/auth/register",
        json={"email": "attacker@college.edu", "password": "SecurePassword123!", "name": "Attacker Student"}
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "attacker@college.edu", "password": "SecurePassword123!"}
    )
    attacker_header = {"Authorization": f"Bearer {login_res.json()['access_token']}"}

    # Student 1 creates print job
    doc_id = _upload_test_doc(client, student_auth_header, valid_pdf_bytes)
    res = client.post(
        "/api/v1/print-requests",
        headers=student_auth_header,
        json={"document_id": doc_id, "copies": 1, "color_mode": "bw", "page_range": "1"}
    )
    req_id = res.json()["id"]

    # Attacker attempts to view payment
    forbidden_get = client.get(f"/api/v1/payments/request/{req_id}", headers=attacker_header)
    assert forbidden_get.status_code == status.HTTP_403_FORBIDDEN

    # Attacker attempts to pay for student 1's job
    forbidden_pay = client.post(
        "/api/v1/payments/process",
        headers=attacker_header,
        json={"request_id": req_id, "payment_method": "card", "card_number": "4242 4242 4242 4242", "card_expiry": "12/28", "card_cvv": "123"}
    )
    assert forbidden_pay.status_code == status.HTTP_403_FORBIDDEN


def test_staff_confirm_payment_at_counter(client, student_auth_header, staff_auth_header, valid_pdf_bytes):
    doc_id = _upload_test_doc(client, student_auth_header, valid_pdf_bytes)
    res = client.post(
        "/api/v1/print-requests",
        headers=student_auth_header,
        json={"document_id": doc_id, "copies": 3, "color_mode": "bw", "page_range": "1"}
    )
    req_id = res.json()["id"]

    # Staff confirms payment
    confirm_res = client.post(
        "/api/v1/payments/staff-confirm",
        headers=staff_auth_header,
        json={"request_id": req_id, "payment_method": "cash", "notes": "Paid $0.30 exact change"}
    )
    assert confirm_res.status_code == status.HTTP_200_OK
    data = confirm_res.json()
    assert data["status"] == "COMPLETED"
    assert data["payment_method"] == "cash"
    assert data["staff_name"] is not None


def test_admin_reports_includes_revenue(client, admin_auth_header, student_auth_header, valid_pdf_bytes):
    doc_id = _upload_test_doc(client, student_auth_header, valid_pdf_bytes)
    res = client.post(
        "/api/v1/print-requests",
        headers=student_auth_header,
        json={"document_id": doc_id, "copies": 5, "color_mode": "color", "page_range": "1-2"}
    )
    req_id = res.json()["id"]

    # Pay: 2 pages * 5 copies = 10 pages * 0.50 = $5.00
    client.post(
        "/api/v1/payments/process",
        headers=student_auth_header,
        json={"request_id": req_id, "payment_method": "card", "card_number": "4242 4242 4242 4242", "card_expiry": "12/28", "card_cvv": "123"}
    )

    report_res = client.get("/api/v1/admin/reports", headers=admin_auth_header)
    assert report_res.status_code == status.HTTP_200_OK
    rep = report_res.json()
    assert rep["total_revenue"] >= 5.00
    assert rep["total_paid_requests"] >= 1
    assert "card" in rep["revenue_by_method"]
