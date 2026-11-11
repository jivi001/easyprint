import io
from fastapi import status


def _create_test_request(client, student_auth_header, valid_pdf_bytes):
    files = {"file": ("notes.pdf", io.BytesIO(valid_pdf_bytes), "application/pdf")}
    upload_res = client.post("/api/v1/documents/upload", headers=student_auth_header, files=files)
    doc_id = upload_res.json()["id"]
    req_res = client.post(
        "/api/v1/print-requests",
        headers=student_auth_header,
        json={"document_id": doc_id, "copies": 1}
    )
    return req_res.json()["id"]


def test_notification_generated_on_ready_status(
    client,
    student_auth_header,
    staff_auth_header,
    valid_pdf_bytes
):
    request_id = _create_test_request(client, student_auth_header, valid_pdf_bytes)

    # Initial notifications check
    n0 = client.get("/api/v1/notifications", headers=student_auth_header)
    assert n0.status_code == status.HTTP_200_OK
    assert n0.json()["unread_count"] == 0

    # Staff moves to PROCESSING
    client.patch(
        f"/api/v1/print-requests/{request_id}/status",
        headers=staff_auth_header,
        json={"status": "PROCESSING"}
    )

    # Staff moves to READY
    client.patch(
        f"/api/v1/print-requests/{request_id}/status",
        headers=staff_auth_header,
        json={"status": "READY"}
    )

    # Student checks notifications
    n1 = client.get("/api/v1/notifications", headers=student_auth_header)
    data = n1.json()
    assert data["unread_count"] == 2
    assert len(data["notifications"]) == 2
    
    ready_msg = next((n for n in data["notifications"] if "READY" in n["message"]), None)
    assert ready_msg is not None
    assert ready_msg["is_read"] is False

    # Mark as read
    mark_res = client.patch(f"/api/v1/notifications/{ready_msg['id']}/read", headers=student_auth_header)
    assert mark_res.status_code == status.HTTP_200_OK
    assert mark_res.json()["is_read"] is True

    # Check unread count decremented
    n2 = client.get("/api/v1/notifications", headers=student_auth_header)
    assert n2.json()["unread_count"] == 1


def test_mark_all_notifications_read(
    client,
    student_auth_header,
    staff_auth_header,
    valid_pdf_bytes
):
    request_id = _create_test_request(client, student_auth_header, valid_pdf_bytes)
    client.patch(
        f"/api/v1/print-requests/{request_id}/status",
        headers=staff_auth_header,
        json={"status": "PROCESSING"}
    )
    client.patch(
        f"/api/v1/print-requests/{request_id}/status",
        headers=staff_auth_header,
        json={"status": "READY"}
    )

    read_all = client.post("/api/v1/notifications/read-all", headers=student_auth_header)
    assert read_all.status_code == status.HTTP_200_OK

    n_after = client.get("/api/v1/notifications", headers=student_auth_header)
    assert n_after.json()["unread_count"] == 0
