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

  function getCurrentPartyNameByMemberId(memberId, baseDate) {
    const record = getCurrentPartyRecordByMemberId(memberId, baseDate);
    if (!record) return "";
    const party = getPartyById(record.party_id);
    return party ? party.party_name : "";
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
          current_party_name: getCurrentPartyNameByMemberId(member.member_id, baseDate)
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
      member_parties: getArray("member_parties").length
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
