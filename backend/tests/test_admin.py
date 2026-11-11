from fastapi import status


def test_admin_reports_access(client, admin_auth_header, staff_auth_header, student_auth_header):
    # Admin can access reports
    res_admin = client.get("/api/v1/admin/reports", headers=admin_auth_header)
    assert res_admin.status_code == status.HTTP_200_OK
    data = res_admin.json()
    assert "total_users" in data
    assert "requests_by_status" in data

    # Staff can access reports
    res_staff = client.get("/api/v1/admin/reports", headers=staff_auth_header)
    assert res_staff.status_code == status.HTTP_200_OK

    # Student cannot access reports -> 403 Forbidden
    res_student = client.get("/api/v1/admin/reports", headers=student_auth_header)
    assert res_student.status_code == status.HTTP_403_FORBIDDEN


def test_admin_audit_logs_access(client, admin_auth_header, staff_auth_header, student_auth_header):
    # Admin can view audit logs
    res_admin = client.get("/api/v1/admin/audit-logs", headers=admin_auth_header)
    assert res_admin.status_code == status.HTTP_200_OK
    assert isinstance(res_admin.json(), list)

    # Staff cannot view audit logs -> 403 Forbidden
    res_staff = client.get("/api/v1/admin/audit-logs", headers=staff_auth_header)
    assert res_staff.status_code == status.HTTP_403_FORBIDDEN

    # Student cannot view audit logs -> 403 Forbidden
    res_student = client.get("/api/v1/admin/audit-logs", headers=student_auth_header)
    assert res_student.status_code == status.HTTP_403_FORBIDDEN


def test_admin_user_management(client, admin_auth_header, student_user):
    # Admin lists users
    res = client.get("/api/v1/admin/users", headers=admin_auth_header)
    assert res.status_code == status.HTTP_200_OK
    users = res.json()
    assert any(u["id"] == str(student_user.id) for u in users)

    # Admin promotes student to staff
    update_res = client.patch(
        f"/api/v1/admin/users/{student_user.id}/role",
        headers=admin_auth_header,
        json={"role": "staff"}
    )
    assert update_res.status_code == status.HTTP_200_OK
    assert update_res.json()["role"] == "staff"
