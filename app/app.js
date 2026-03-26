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

  function getMemberById(memberId) {
    return getArray("members").find(function (member) {
      return member.member_id === memberId;
    }) || null;
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

  function getCurrentOfficeTermsByMemberId(memberId, baseDate) {
    return getArray("office_terms").filter(function (term) {
      return term.member_id === memberId && isCurrentOfficeTerm(term, baseDate);
    });
  }

  function getOfficeTermsByMemberId(memberId) {
    return getArray("office_terms")
      .filter(function (term) {
        return term.member_id === memberId;
      })
      .sort(function (a, b) {
        const aStart = a.term_start_date || "";
        const bStart = b.term_start_date || "";
        return aStart < bStart ? 1 : aStart > bStart ? -1 : 0;
      });
  }

  function getCurrentStatusByMemberId(memberId, baseDate) {
    const terms = getCurrentOfficeTermsByMemberId(memberId, baseDate);
    return terms.length > 0 ? "現職" : "過去在任";
  }

  function formatPartyLabel(party, roleName) {
    if (!party) return "";
    const name = party.party_name || "";
    const role = roleName || "";
    return role ? name + "（" + role + "）" : name;
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

  function getPartyHistoryByMemberId(memberId) {
    return getArray("member_parties")
      .filter(function (row) {
        return row.member_id === memberId;
      })
      .sort(function (a, b) {
        const aStart = a.start_date || "";
        const bStart = b.start_date || "";
        return aStart < bStart ? 1 : aStart > bStart ? -1 : 0;
      });
  }

  function getCurrentPartyNameByMemberId(memberId, baseDate) {
    const record = getCurrentPartyRecordByMemberId(memberId, baseDate);
    if (!record) return "";
    const party = getPartyById(record.party_id);
    return formatPartyLabel(party, record.role_name || "");
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

  function getCommitteeHistoryByMemberId(memberId) {
    return getArray("member_committees")
      .filter(function (row) {
        return row.member_id === memberId;
      })
      .sort(function (a, b) {
        const aStart = a.start_date || "";
        const bStart = b.start_date || "";
        return aStart < bStart ? 1 : aStart > bStart ? -1 : 0;
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

  function getCouncilHistoryByMemberId(memberId) {
    return getArray("member_councils")
      .filter(function (row) {
        return row.member_id === memberId;
      })
      .sort(function (a, b) {
        const aStart = a.start_date || "";
        const bStart = b.start_date || "";
        return aStart < bStart ? 1 : aStart > bStart ? -1 : 0;
      });
  }

  function getCurrentContactRecordByMemberId(memberId, baseDate) {
    const records = getArray("contacts")
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

  function getContactHistoryByMemberId(memberId) {
    return getArray("contacts")
      .filter(function (row) {
        return row.member_id === memberId;
      })
      .sort(function (a, b) {
        const aStart = a.start_date || "";
        const bStart = b.start_date || "";
        return aStart < bStart ? 1 : aStart > bStart ? -1 : 0;
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

  function getCommitteeOptions() {
    return getArray("committees")
      .filter(function (committee) {
        return String(committee.active_flag || "0") === "1";
      })
      .slice()
      .sort(function (a, b) {
        const aOrder = Number(a.sort_order || 0);
        const bOrder = Number(b.sort_order || 0);
        return aOrder - bOrder;
      })
      .map(function (committee) {
        return {
          committee_id: committee.committee_id || "",
          committee_name: committee.committee_name || ""
        };
      });
  }

  function hasCurrentCommittee(memberId, committeeId, baseDate) {
    return getCurrentCommitteeRecordsByMemberId(memberId, baseDate).some(function (row) {
      return row.committee_id === committeeId;
    });
  }

  function buildSearchTextForMember(memberId, baseDate) {
    const member = getMemberById(memberId);
    const officeTerms = getOfficeTermsByMemberId(memberId);
    const partyHistory = getPartyHistoryByMemberId(memberId);
    const committeeHistory = getCommitteeHistoryByMemberId(memberId);
    const councilHistory = getCouncilHistoryByMemberId(memberId);
    const contactHistory = getContactHistoryByMemberId(memberId);
    const currentParty = getCurrentPartyNameByMemberId(memberId, baseDate);
    const currentCommittees = getCurrentCommitteeLabelsByMemberId(memberId, baseDate);
    const currentCouncils = getCurrentCouncilLabelsByMemberId(memberId, baseDate);
    const currentContact = getCurrentContactRecordByMemberId(memberId, baseDate);

    const chunks = [];

    if (member) {
      chunks.push(member.member_name || "");
      chunks.push(member.member_name_short || "");
      chunks.push(member.member_kana || "");
      chunks.push(member.note || "");
    }

    chunks.push(currentParty || "");
    chunks.push((currentCommittees || []).join(" "));
    chunks.push((currentCouncils || []).join(" "));

    officeTerms.forEach(function (row) {
      chunks.push(row.election_label || "");
      chunks.push(row.end_reason_code || "");
      chunks.push(row.note || "");
    });

    partyHistory.forEach(function (row) {
      const party = getPartyById(row.party_id);
      chunks.push(party ? party.party_name : "");
      chunks.push(row.role_name || "");
      chunks.push(row.note || "");
    });

    committeeHistory.forEach(function (row) {
      const committee = getCommitteeById(row.committee_id);
      chunks.push(committee ? committee.committee_name : "");
      chunks.push(row.role_name || "");
      chunks.push(row.note || "");
    });

    councilHistory.forEach(function (row) {
      const council = getCouncilById(row.council_id);
      chunks.push(council ? council.council_name : "");
      chunks.push(row.role_name || "");
      chunks.push(row.note || "");
    });

    contactHistory.forEach(function (row) {
      chunks.push(row.postal_code || "");
      chunks.push(row.address || "");
      chunks.push(row.phone_home || "");
      chunks.push(row.phone_home_visibility || "");
      chunks.push(row.phone_mobile || "");
      chunks.push(row.phone_mobile_visibility || "");
      chunks.push(row.email || "");
      chunks.push(row.email_visibility || "");
      chunks.push(row.contact_note || "");
      chunks.push(row.address_visibility || "");
    });

    if (currentContact) {
      chunks.push(currentContact.postal_code || "");
      chunks.push(currentContact.address || "");
      chunks.push(currentContact.address_visibility || "");
      chunks.push(currentContact.phone_home || "");
      chunks.push(currentContact.phone_home_visibility || "");
      chunks.push(currentContact.phone_mobile || "");
      chunks.push(currentContact.phone_mobile_visibility || "");
      chunks.push(currentContact.email || "");
      chunks.push(currentContact.email_visibility || "");
      chunks.push(currentContact.contact_note || "");
    }

    return chunks.join(" ").toLowerCase();
  }

  function filterMemberList(rows, conditions, baseDate) {
    const name = (conditions.name || "").trim().toLowerCase();
    const partyId = (conditions.party_id || "").trim();
    const committeeId = (conditions.committee_id || "").trim();
    const keyword = (conditions.keyword || "").trim().toLowerCase();

    return rows.filter(function (row) {
      const hitName =
        !name ||
        String(row.member_name || "").toLowerCase().includes(name);

      const currentPartyRecord = getCurrentPartyRecordByMemberId(row.member_id, baseDate);
      const currentPartyId = currentPartyRecord ? currentPartyRecord.party_id : "";
      const hitParty = !partyId || currentPartyId === partyId;

      const hitCommittee =
        !committeeId ||
        hasCurrentCommittee(row.member_id, committeeId, baseDate);

      const hitKeyword =
        !keyword ||
        buildSearchTextForMember(row.member_id, baseDate).includes(keyword);

      return hitName && hitParty && hitCommittee && hitKeyword;
    });
  }

  function buildMemberDetail(memberId, baseDate) {
    const member = getMemberById(memberId);
    if (!member) return null;

    const currentContact = getCurrentContactRecordByMemberId(memberId, baseDate);
    const officeTerms = getOfficeTermsByMemberId(memberId);
    const partyHistory = getPartyHistoryByMemberId(memberId).map(function (row) {
      const party = getPartyById(row.party_id);
      return {
        start_date: row.start_date || "",
        end_date: row.end_date || "",
        party_name: party ? party.party_name : "",
        role_name: row.role_name || "",
        note: row.note || ""
      };
    });

    const committeeHistory = getCommitteeHistoryByMemberId(memberId).map(function (row) {
      const committee = getCommitteeById(row.committee_id);
      return {
        start_date: row.start_date || "",
        end_date: row.end_date || "",
        committee_name: committee ? committee.committee_name : "",
        role_name: row.role_name || "",
        note: row.note || ""
      };
    });

    const councilHistory = getCouncilHistoryByMemberId(memberId).map(function (row) {
      const council = getCouncilById(row.council_id);
      return {
        start_date: row.start_date || "",
        end_date: row.end_date || "",
        council_name: council ? council.council_name : "",
        role_name: row.role_name || "",
        note: row.note || ""
      };
    });

    const contactHistory = getContactHistoryByMemberId(memberId).map(function (row) {
      return {
        start_date: row.start_date || "",
        end_date: row.end_date || "",
        postal_code: row.postal_code || "",
        address: row.address || "",
        address_visibility: row.address_visibility || "",
        phone_home: row.phone_home || "",
        phone_home_visibility: row.phone_home_visibility || "",
        phone_mobile: row.phone_mobile || "",
        phone_mobile_visibility: row.phone_mobile_visibility || "",
        email: row.email || "",
        email_visibility: row.email_visibility || "",
        contact_note: row.contact_note || ""
      };
    });

    return {
      member_id: member.member_id || "",
      member_no: member.member_no || "",
      member_name: member.member_name || "",
      member_name_short: member.member_name_short || "",
      member_kana: member.member_kana || "",
      birth_date: member.birth_date || "",
      age: member.age || "",
      gender: member.gender || "",
      note: member.note || "",
      current_status: getCurrentStatusByMemberId(memberId, baseDate),
      current_party_name: getCurrentPartyNameByMemberId(memberId, baseDate),
      current_committees: getCurrentCommitteeLabelsByMemberId(memberId, baseDate),
      current_councils: getCurrentCouncilLabelsByMemberId(memberId, baseDate),
      current_contact: currentContact ? {
        postal_code: currentContact.postal_code || "",
        address: currentContact.address || "",
        address_visibility: currentContact.address_visibility || "",
        phone_home: currentContact.phone_home || "",
        phone_home_visibility: currentContact.phone_home_visibility || "",
        phone_mobile: currentContact.phone_mobile || "",
        phone_mobile_visibility: currentContact.phone_mobile_visibility || "",
        email: currentContact.email || "",
        email_visibility: currentContact.email_visibility || "",
        contact_note: currentContact.contact_note || ""
      } : null,
      office_terms: officeTerms,
      party_history: partyHistory,
      committee_history: committeeHistory,
      council_history: councilHistory,
      contact_history: contactHistory
    };
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
    buildMemberList: buildMemberList,
    buildMemberDetail: buildMemberDetail,
    getPartyOptions: getPartyOptions,
    getCommitteeOptions: getCommitteeOptions,
    filterMemberList: filterMemberList,
    getSummaryCounts: getSummaryCounts
  };
})();
