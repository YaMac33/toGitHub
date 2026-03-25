window.APP_DATA = window.APP_DATA || {};

window.APP = (function () {
  "use strict";

  function getArray(name) {
    return Array.isArray(window.APP_DATA[name]) ? window.APP_DATA[name] : [];
  }

  function parseDate(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr + "T00:00:00");
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function isCurrentRange(startDateStr, endDateStr, baseDate) {
    const base = baseDate || new Date();
    const start = parseDate(startDateStr);
    const end = parseDate(endDateStr);

    if (!start) return false;
    if (start > base) return false;
    if (end && end < base) return false;

    return true;
  }

  function isCurrentOfficeTerm(term, baseDate) {
    if (!term) return false;
    return isCurrentRange(term.term_start_date, term.term_end_date, baseDate);
  }

  function getCurrentOfficeTermsByMemberId(memberId, baseDate) {
    return getArray("office_terms").filter(function (term) {
      return term.member_id === memberId && isCurrentOfficeTerm(term, baseDate);
    });
  }

  function getCurrentStatusByMemberId(memberId, baseDate) {
    const terms = getCurrentOfficeTermsByMemberId(memberId, baseDate);
    return terms.length > 0 ? "現職" : "過去在任";
  }

  function getCurrentPartyRecordByMemberId(memberId, baseDate) {
    const records = getArray("member_parties")
      .filter(function (row) {
        return row.member_id === memberId &&
          isCurrentRange(row.start_date, row.end_date, baseDate);
      })
      .sort(function (a, b) {
        const aStart = a.start_date || "";
        const bStart = b.start_date || "";
        return aStart < bStart ? 1 : aStart > bStart ? -1 : 0;
      });

    return records[0] || null;
  }

  function getPartyById(partyId) {
    return getArray("parties").find(function (party) {
      return party.party_id === partyId;
    }) || null;
  }

  function getCommitteeById(committeeId) {
    return getArray("committees").find(function (committee) {
      return committee.committee_id === committeeId;
    }) || null;
  }

  function getCouncilById(councilId) {
    return getArray("councils").find(function (council) {
      return council.council_id === councilId;
    }) || null;
  }

  function getCurrentPartyNameByMemberId(memberId, baseDate) {
    const record = getCurrentPartyRecordByMemberId(memberId, baseDate);
    if (!record) return "";
    const party = getPartyById(record.party_id);
    return party ? party.party_name : "";
  }

  function getCurrentCommitteeRecordsByMemberId(memberId, baseDate) {
    return getArray("member_committees")
      .filter(function (row) {
        return row.member_id === memberId &&
          isCurrentRange(row.start_date, row.end_date, baseDate);
      })
      .sort(function (a, b) {
        const committeeA = getCommitteeById(a.committee_id);
        const committeeB = getCommitteeById(b.committee_id);
        const orderA = Number(committeeA && committeeA.sort_order ? committeeA.sort_order : 9999);
        const orderB = Number(committeeB && committeeB.sort_order ? committeeB.sort_order : 9999);
        return orderA - orderB;
      });
  }

  function getCurrentCouncilRecordsByMemberId(memberId, baseDate) {
    return getArray("member_councils")
      .filter(function (row) {
        return row.member_id === memberId &&
          isCurrentRange(row.start_date, row.end_date, baseDate);
      })
      .sort(function (a, b) {
        const councilA = getCouncilById(a.council_id);
        const councilB = getCouncilById(b.council_id);
        const orderA = Number(councilA && councilA.sort_order ? councilA.sort_order : 9999);
        const orderB = Number(councilB && councilB.sort_order ? councilB.sort_order : 9999);
        return orderA - orderB;
      });
  }

  function formatCommitteeLabel(record) {
    const committee = getCommitteeById(record.committee_id);
    if (!committee) return "";
    const name = committee.committee_name || "";
    const role = record.role_name || "";
    return role ? name + "（" + role + "）" : name;
  }

  function formatCouncilLabel(record) {
    const council = getCouncilById(record.council_id);
    if (!council) return "";
    const name = council.council_name || "";
    const role = record.role_name || "";
    return role ? name + "（" + role + "）" : name;
  }

  function getCurrentCommitteeLabelsByMemberId(memberId, baseDate) {
    return getCurrentCommitteeRecordsByMemberId(memberId, baseDate)
      .map(formatCommitteeLabel)
      .filter(function (label) {
        return label !== "";
      });
  }

  function getCurrentCouncilLabelsByMemberId(memberId, baseDate) {
    return getCurrentCouncilRecordsByMemberId(memberId, baseDate)
      .map(formatCouncilLabel)
      .filter(function (label) {
        return label !== "";
      });
  }

  function buildMemberList(baseDate) {
    return getArray("members")
      .slice()
      .sort(function (a, b) {
        const aOrder = Number(a.sort_order || 0);
        const bOrder = Number(b.sort_order || 0);
        return aOrder - bOrder;
      })
      .map(function (member) {
        return {
          member_id: member.member_id || "",
          member_no: member.member_no || "",
          member_name: member.member_name || "",
          member_name_short: member.member_name_short || "",
          age: member.age || "",
          current_status: getCurrentStatusByMemberId(member.member_id, baseDate),
          current_party_name: getCurrentPartyNameByMemberId(member.member_id, baseDate),
          current_committees: getCurrentCommitteeLabelsByMemberId(member.member_id, baseDate),
          current_councils: getCurrentCouncilLabelsByMemberId(member.member_id, baseDate)
        };
      });
  }

  function getPartyOptions() {
    return getArray("parties")
      .filter(function (party) {
        return String(party.active_flag || "0") === "1";
      })
      .slice()
      .sort(function (a, b) {
        const aOrder = Number(a.sort_order || 0);
        const bOrder = Number(b.sort_order || 0);
        return aOrder - bOrder;
      })
      .map(function (party) {
        return {
          party_id: party.party_id || "",
          party_name: party.party_name || ""
        };
      });
  }

  function filterMemberList(rows, conditions) {
    const name = (conditions.name || "").trim().toLowerCase();
    const partyId = (conditions.party_id || "").trim();
    const status = (conditions.status || "").trim();

    return rows.filter(function (row) {
      const hitName =
        !name ||
        String(row.member_name || "").toLowerCase().includes(name) ||
        String(row.member_name_short || "").toLowerCase().includes(name);

      const currentPartyRecord = getCurrentPartyRecordByMemberId(row.member_id);
      const currentPartyId = currentPartyRecord ? currentPartyRecord.party_id : "";

      const hitParty = !partyId || currentPartyId === partyId;

      const hitStatus =
        !status ||
        (status === "current" && row.current_status === "現職") ||
        (status === "past" && row.current_status === "過去在任");

      return hitName && hitParty && hitStatus;
    });
  }

  function getSummaryCounts() {
    return {
      members: getArray("members").length,
      office_terms: getArray("office_terms").length,
      parties: getArray("parties").length,
      member_parties: getArray("member_parties").length,
      member_committees: getArray("member_committees").length,
      member_councils: getArray("member_councils").length
    };
  }

  return {
    getArray: getArray,
    buildMemberList: buildMemberList,
    getPartyOptions: getPartyOptions,
    filterMemberList: filterMemberList,
    getSummaryCounts: getSummaryCounts
  };
})();
