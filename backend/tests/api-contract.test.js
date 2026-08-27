const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { errorBody } = require("../src/utils/api");
const { isValidStudentNumber, parsePagination, assertAllowedFields } = require("../src/utils/validators");

test("OpenAPI contract parses and documents critical endpoint groups", () => {
    const spec = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../docs/api/openapi.json"), "utf8"));
    assert.match(spec.openapi, /^3\./);
    for (const route of ["/login", "/students/me", "/students/me/violations", "/students/me/community-service/dtr", "/violations/{id}/actions", "/community-service/attendance/time-in", "/community-service/attendance/time-out", "/community-service/{assignmentId}/sessions", "/clearance/student/{studentId}/eligibility", "/reports/dtr", "/audit-logs", "/health"]) assert.ok(spec.paths[route], `OpenAPI missing ${route}`);
    for (const schema of ["StudentSummary", "Violation", "ViolationAction", "CommunityServiceAssignment", "DtrSession", "ServiceProgress", "Clearance", "AuditEntry", "ErrorResponse", "PaginationMetadata"]) assert.ok(spec.components.schemas[schema], `OpenAPI missing ${schema}`);
});

test("validation and error envelopes expose stable machine-readable contracts", () => {
    assert.deepEqual(errorBody("ACTIVE_SESSION_EXISTS", "Already active"), { success: false, message: "Already active", error: { code: "ACTIVE_SESSION_EXISTS", message: "Already active" } });
    assert.equal(isValidStudentNumber("02000123456"), true);
    assert.equal(isValidStudentNumber("2000123456"), false);
    assert.deepEqual(parsePagination({}), { page: 1, limit: 25, offset: 0 });
    assert.throws(() => parsePagination({ limit: "101" }), /limit/);
    assert.throws(() => assertAllowedFields({ role: "ADMIN" }, ["first_name"]), /Unsupported field/);
});

test("canonical violation and DTR enums remain stable", () => {
    const spec = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../docs/api/openapi.json"), "utf8"));
    assert.deepEqual(spec.components.schemas.Violation.properties.status.enum, ["OPEN", "COMPLETE", "CLEAR", "INVALID_CANCEL"]);
    assert.deepEqual(spec.components.schemas.ViolationAction.properties.action.enum, ["COMPLETE", "CLEAR", "INVALID_CANCEL", "REOPEN"]);
    assert.deepEqual(spec.components.schemas.DtrSession.properties.status.enum, ["ACTIVE", "COMPLETED"]);
});
