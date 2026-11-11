import io
from fastapi import status


def _upload_test_doc(client, auth_header, valid_pdf_bytes, filename="paper.pdf"):
    files = {"file": (filename, io.BytesIO(valid_pdf_bytes), "application/pdf")}
    res = client.post("/api/v1/documents/upload", headers=auth_header, files=files)
    return res.json()["id"]


def test_submit_print_request_success(client, student_auth_header, valid_pdf_bytes):
    doc_id = _upload_test_doc(client, student_auth_header, valid_pdf_bytes)
    payload = {
        "document_id": doc_id,
        "copies": 3,
        "color_mode": "color",
        "duplex": "double",
        "page_range": "1-10",
        "orientation": "portrait",
        "paper_size": "A4"
    }
    response = client.post("/api/v1/print-requests", headers=student_auth_header, json=payload)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["status"] == "PENDING"
    assert data["copies"] == 3
    assert data["color_mode"] == "color"
    assert data["duplex"] == "double"
    assert data["settings"]["copies"] == 3
    assert len(data["status_history"]) == 1
    assert data["status_history"][0]["new_status"] == "PENDING"


def test_complete_printing_workflow_lifecycle(
    client,
    student_auth_header,
    staff_auth_header,
    valid_pdf_bytes
):
    """
    Tests full happy path:
    PENDING -> PROCESSING -> READY -> COLLECTED
    """
    doc_id = _upload_test_doc(client, student_auth_header, valid_pdf_bytes)
    create_res = client.post(
        "/api/v1/print-requests",
        headers=student_auth_header,
        json={"document_id": doc_id, "copies": 2, "color_mode": "bw", "duplex": "single"}
    )
    request_id = create_res.json()["id"]

    # 1. Staff moves PENDING -> PROCESSING
    p1 = client.patch(
        f"/api/v1/print-requests/{request_id}/status",
        headers=staff_auth_header,
        json={"status": "PROCESSING", "comment": "Printing job started"}
    )
    assert p1.status_code == status.HTTP_200_OK
    assert p1.json()["status"] == "PROCESSING"

    # 2. Staff moves PROCESSING -> READY
    p2 = client.patch(
        f"/api/v1/print-requests/{request_id}/status",
        headers=staff_auth_header,
        json={"status": "READY", "comment": "Document printed and placed in tray 4"}
    )
    assert p2.status_code == status.HTTP_200_OK
    assert p2.json()["status"] == "READY"

    # 3. Staff moves READY -> COLLECTED
    p3 = client.patch(
        f"/api/v1/print-requests/{request_id}/status",
        headers=staff_auth_header,
        json={"status": "COLLECTED", "comment": "Collected by student"}
    )
    assert p3.status_code == status.HTTP_200_OK
    assert p3.json()["status"] == "COLLECTED"

    # Verify history audit trail
    detail = client.get(f"/api/v1/print-requests/{request_id}", headers=staff_auth_header).json()
    assert len(detail["status_history"]) == 4
    statuses = [h["new_status"] for h in detail["status_history"]]
    assert statuses == ["PENDING", "PROCESSING", "READY", "COLLECTED"]


def test_invalid_status_transition_rejected(
    client,
    student_auth_header,
    staff_auth_header,
    valid_pdf_bytes
):
    """
    Rejects illegal transitions:
    e.g. PENDING directly to COLLECTED
    """
    doc_id = _upload_test_doc(client, student_auth_header, valid_pdf_bytes)
    create_res = client.post(
        "/api/v1/print-requests",
        headers=student_auth_header,
        json={"document_id": doc_id, "copies": 1}
    )
    request_id = create_res.json()["id"]

    # Attempt illegal jump PENDING -> COLLECTED
    bad_res = client.patch(
        f"/api/v1/print-requests/{request_id}/status",
        headers=staff_auth_header,
        json={"status": "COLLECTED"}
    )
    assert bad_res.status_code == status.HTTP_400_BAD_REQUEST
    assert "Illegal status transition" in bad_res.json()["detail"]["message"]


def test_student_cannot_advance_processing_or_ready(
    client,
    student_auth_header,
    valid_pdf_bytes
):
    """
    Students are strictly forbidden from moving status to PROCESSING or READY.
    """
    doc_id = _upload_test_doc(client, student_auth_header, valid_pdf_bytes)
    create_res = client.post(
        "/api/v1/print-requests",
        headers=student_auth_header,
        json={"document_id": doc_id, "copies": 1}
    )
    request_id = create_res.json()["id"]

    # Student attempts to mark job READY
    res = client.patch(
        f"/api/v1/print-requests/{request_id}/status",
        headers=student_auth_header,
        json={"status": "READY"}
    )
    assert res.status_code == status.HTTP_403_FORBIDDEN


def test_student_can_cancel_own_pending_request(
    client,
    student_auth_header,
    valid_pdf_bytes
):
    doc_id = _upload_test_doc(client, student_auth_header, valid_pdf_bytes)
    create_res = client.post(
        "/api/v1/print-requests",
        headers=student_auth_header,
        json={"document_id": doc_id, "copies": 1}
    )
    request_id = create_res.json()["id"]

    # Student cancels pending request
    res = client.patch(
        f"/api/v1/print-requests/{request_id}/status",
        headers=student_auth_header,
        json={"status": "CANCELLED", "comment": "Changed my mind"}
    )
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["status"] == "CANCELLED"


def test_staff_failed_print_workflow(
    client,
    student_auth_header,
    staff_auth_header,
    valid_pdf_bytes
):
    doc_id = _upload_test_doc(client, student_auth_header, valid_pdf_bytes)
    create_res = client.post(
        "/api/v1/print-requests",
        headers=student_auth_header,
        json={"document_id": doc_id, "copies": 1}
    )
    request_id = create_res.json()["id"]

    # Advance to PROCESSING
    client.patch(
        f"/api/v1/print-requests/{request_id}/status",
        headers=staff_auth_header,
        json={"status": "PROCESSING"}
    )

    # Fail job due to paper jam or out of toner
    fail_res = client.patch(
        f"/api/v1/print-requests/{request_id}/status",
        headers=staff_auth_header,
        json={"status": "FAILED", "comment": "Hardware printer paper jam"}
    )
    assert fail_res.status_code == status.HTTP_200_OK
    assert fail_res.json()["status"] == "FAILED"
