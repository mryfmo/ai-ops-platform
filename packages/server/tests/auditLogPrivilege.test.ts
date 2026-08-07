/**
 * packages/server/tests/auditLogPrivilege.test.ts
 *
 * 根拠: DevOps:REQ-028。監査ログの追記専用がDB権限で実際に強制されているかの判定を検証する。
 *   所見 ADV-SEC-005（schema.sql の REVOKE は app_role 不在なら黙ってスキップされる）。
 */
import { describe, expect, it } from "vitest";
import { judgeAuditLogPrivilege } from "../src/lib/auditLogPrivilege.js";

describe("judgeAuditLogPrivilege [DevOps:REQ-028]", () => {
  it("UPDATE/DELETEどちらも持たなければ追記専用が成立している [DevOps:REQ-028]", () => {
    expect(judgeAuditLogPrivilege({ canUpdate: false, canDelete: false, canTruncate: false })).toEqual({
      appendOnly: true,
    });
  });

  it("UPDATE権限があれば成立していない [DevOps:REQ-028]", () => {
    const verdict = judgeAuditLogPrivilege({ canUpdate: true, canDelete: false, canTruncate: false });

    expect(verdict.appendOnly).toBe(false);
    expect(verdict.reason).toContain("UPDATE");
  });

  it("DELETE権限があれば成立していない [DevOps:REQ-028]", () => {
    const verdict = judgeAuditLogPrivilege({ canUpdate: false, canDelete: true, canTruncate: false });

    expect(verdict.appendOnly).toBe(false);
    expect(verdict.reason).toContain("DELETE");
  });

  it("TRUNCATE権限があれば成立していない（履歴を丸ごと消せる） [DevOps:REQ-028]", () => {
    const verdict = judgeAuditLogPrivilege({ canUpdate: false, canDelete: false, canTruncate: true });

    expect(verdict.appendOnly).toBe(false);
    expect(verdict.reason).toContain("TRUNCATE");
  });

  it("すべてあればすべてを理由に挙げる [DevOps:REQ-028]", () => {
    // トリガ防御は併存するが、これらの権限を持つロールはトリガ自体を落とせる。
    const verdict = judgeAuditLogPrivilege({ canUpdate: true, canDelete: true, canTruncate: true });

    expect(verdict.appendOnly).toBe(false);
    expect(verdict.reason).toContain("UPDATE");
    expect(verdict.reason).toContain("DELETE");
  });
});
