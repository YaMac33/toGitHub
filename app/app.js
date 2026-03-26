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

  function getMeetingById(meetingId) {
    return getArray("meetings").find(function (meeting) {
      return meeting.meeting_id === meetingId;
    }) || null;
  }

  function getSpecialCommitteeById(specialCommitteeId) {
    return getArray("special_committees").find(function (row) {
      return row.special_committee_id === specialCommitteeId;
    }) || null;
  }

  function getSpecialCommitteeInstanceById(instanceId) {
    return getArray("special_committee_instances").find(function (row) {
      return row.special_committee_instance_id === instanceId;
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
    return getCurrentOfficeTermsByMemberId(memberId, baseDate).length > 0 ? "現職" : "過去在任";
  }

  function formatPartyLabel(party, roleName) {
    if (!party) return "";
    return roleName ? (party.party_name || "") + "（" + roleName + "）" : (party.party_name || "");
  }

  function getCurrentPartyRecordByMemberId(memberId, baseDate) {
    return getArray("member_parties")
      .filter(function (row) {
        return row.member_id === memberId && isCurrentRange(row.start_date, row.end_date, baseDate);
      })
      .sort(function (a, b) {
        const aStart = a.start_date || "";
        const bStart = b.start_date || "";
        return aStart < bStart ? 1 : aStart > bStart ? -1 : 0;
      })[0] || null;
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
    return formatPartyLabel(getPartyById(record.party_id), record.role_name || "");
  }

  function getCurrentCommitteeRecordsByMemberId(memberId, baseDate) {
    return getArray("member_committees")
      .filter(function (row) {
        return row.member_id === memberId && isCurrentRange(row.start_date, row.end_date, baseDate);
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
        return row.member_id === memberId && isCurrentRange(row.start_date, row.end_date, baseDate);
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
    return getArray("contacts")
      .filter(function (row) {
        return row.member_id === memberId && isCurrentRange(row.start_date, row.end_date, baseDate);
      })
      .sort(function (a, b) {
        const aStart = a.start_date || "";
        const bStart = b.start_date || "";
        return aStart < bStart ? 1 : aStart > bStart ? -1 : 0;
      })[0] || null;
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
    return record.role_name ? committee.committee_name + "（" + record.role_name + "）" : committee.committee_name;
  }

  function formatCouncilLabel(record) {
    const council = getCouncilById(record.council_id);
    if (!council) return "";
    return record.role_name ? council.council_name + "（" + record.role_name + "）" : council.council_name;
  }

  function getCurrentCommitteeLabelsByMemberId(memberId, baseDate) {
    return getCurrentCommitteeRecordsByMemberId(memberId, baseDate)
      .map(formatCommitteeLabel)
      .filter(Boolean);
  }

  function getCurrentCouncilLabelsByMemberId(memberId, baseDate) {
    return getCurrentCouncilRecordsByMemberId(memberId, baseDate)
      .map(formatCouncilLabel)
      .filter(Boolean);
  }

  function getSpecialCommitteeMemberRowsByMemberId(memberId) {
    return getArray("special_committee_members").filter(function (row) {
      return row.member_id === memberId;
    });
  }

  function buildSpecialCommitteeJoinedRow(memberRow) {
    const instance = getSpecialCommitteeInstanceById(memberRow.special_committee_instance_id);
    if (!instance) return null;

    const specialCommittee = getSpecialCommitteeById(instance.special_committee_id);
    const meeting = getMeetingById(instance.meeting_id);

    return {
      special_committee_instance_id: instance.special_committee_instance_id || "",
      meeting_id: instance.meeting_id || "",
      meeting_name: meeting ? (meeting.session_name || "") : "",
      meeting_start_date: meeting ? (meeting.start_date || "") : "",
      special_committee_id: instance.special_committee_id || "",
      special_committee_name: specialCommittee ? (specialCommittee.special_committee_name || "") : "",
      special_committee_type: specialCommittee ? (specialCommittee.special_committee_type || "") : "",
      established_date: instance.established_date || "",
      instance_end_date: instance.end_date || "",
      instance_note: instance.note || "",
      member_id: memberRow.member_id || "",
      role_name: memberRow.role_name || "",
      member_start_date: memberRow.start_date || "",
      member_end_date: memberRow.end_date || "",
      member_note: memberRow.note || ""
    };
  }

  function getCurrentSpecialCommitteeRowsByMemberId(memberId, baseDate) {
    return getSpecialCommitteeMemberRowsByMemberId(memberId)
      .map(buildSpecialCommitteeJoinedRow)
      .filter(function (row) {
        if (!row) return false;
        const memberCurrent = isCurrentRange(row.member_start_date, row.member_end_date, baseDate);
        const instanceCurrent = isCurrentRange(row.established_date, row.instance_end_date, baseDate);
        return memberCurrent && instanceCurrent;
      })
      .sort(function (a, b) {
        const ad = a.established_date || "";
        const bd = b.established_date || "";
        if (ad !== bd) return ad < bd ? -1 : 1;
        const ao = a.special_committee_name || "";
        const bo = b.special_committee_name || "";
        return ao < bo ? -1 : ao > bo ? 1 : 0;
      });
  }

  function getSpecialCommitteeHistoryByMemberId(memberId) {
    return getSpecialCommitteeMemberRowsByMemberId(memberId)
      .map(buildSpecialCommitteeJoinedRow)
      .filter(Boolean)
      .sort(function (a, b) {
        const ad = a.established_date || "";
        const bd = b.established_date || "";
        if (ad !== bd) return ad < bd ? 1 : -1;
        const ao = a.special_committee_name || "";
        const bo = b.special_committee_name || "";
        return ao < bo ? -1 : ao > bo ? 1 : 0;
      });
  }

  function formatCurrentSpecialCommitteeLabel(row) {
    const base = (row.meeting_name || "") + " / " + (row.special_committee_name || "");
    return row.role_name ? base + "（" + row.role_name + "）" : base;
  }

  function buildCurrentCommitteeDisplayRows(memberId, baseDate) {
    const regularRows = getCurrentCommitteeRecordsByMemberId(memberId, baseDate).map(function (row) {
      const committee = getCommitteeById(row.committee_id);
      return {
        section_type: "regular",
        sort_key: committee ? Number(committee.sort_order || 9999) : 9999,
        label: formatCommitteeLabel(row)
      };
    });

    const specialRows = getCurrentSpecialCommitteeRowsByMemberId(memberId, baseDate).map(function (row) {
      return {
        section_type: "special",
        sort_key: row.established_date || "",
        label: formatCurrentSpecialCommitteeLabel(row)
      };
    });

    return {
      regular: regularRows,
      special: specialRows
    };
  }

  function buildMemberList(baseDate) {
    return getArray("members")
      .slice()
      .sort(function (a, b) {
        return Number(a.sort_order || 0) - Number(b.sort_order || 0);
      })
      .map(function (member) {
        const currentCommittees = buildCurrentCommitteeDisplayRows(member.member_id, baseDate);
        const currentCommitteeLabels = currentCommittees.regular.concat(currentCommittees.special).map(function (row) {
          return row.label;
        });

        return {
          member_id: member.member_id || "",
          member_no: member.member_no || "",
          member_name: member.member_name || "",
          age: member.age || "",
          current_status: getCurrentStatusByMemberId(member.member_id, baseDate),
          current_party_name: getCurrentPartyNameByMemberId(member.member_id, baseDate),
          current_committee_labels: currentCommitteeLabels,
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
        return Number(a.sort_order || 0) - Number(b.sort_order || 0);
      })
      .map(function (party) {
        return {
          party_id: party.party_id || "",
          party_name: party.party_name || ""
        };
      });
  }

  function getCommitteeOptions() {
    const regularOptions = getArray("committees")
      .filter(function (committee) {
        return String(committee.active_flag || "0") === "1";
      })
      .slice()
      .sort(function (a, b) {
        return Number(a.sort_order || 0) - Number(b.sort_order || 0);
      })
      .map(function (committee) {
        return {
          value: "REGULAR:" + (committee.committee_id || ""),
          label: committee.committee_name || ""
        };
      });

    const specialOptions = getArray("special_committees")
      .filter(function (row) {
        return String(row.active_flag || "0") === "1";
      })
      .slice()
      .sort(function (a, b) {
        return Number(a.sort_order || 9999) - Number(b.sort_order || 9999);
      })
      .map(function (row) {
        return {
          value: "SPECIAL:" + (row.special_committee_id || ""),
          label: row.special_committee_name || ""
        };
      });

    return regularOptions.concat(specialOptions);
  }

  function hasCurrentCommittee(memberId, committeeSelectorValue, baseDate) {
    if (!committeeSelectorValue) return true;

    const parts = String(committeeSelectorValue).split(":");
    const selectorType = parts[0] || "";
    const selectorId = parts[1] || "";

    if (selectorType === "REGULAR") {
      return getCurrentCommitteeRecordsByMemberId(memberId, baseDate).some(function (row) {
        return row.committee_id === selectorId;
      });
    }

    if (selectorType === "SPECIAL") {
      return getCurrentSpecialCommitteeRowsByMemberId(memberId, baseDate).some(function (row) {
        return row.special_committee_id === selectorId;
      });
    }

    return true;
  }

  function buildSearchTextForMember(memberId, baseDate) {
    const member = getMemberById(memberId);
    const officeTerms = getOfficeTermsByMemberId(memberId);
    const partyHistory = getPartyHistoryByMemberId(memberId);
    const committeeHistory = getCommitteeHistoryByMemberId(memberId);
    const specialCommitteeHistory = getSpecialCommitteeHistoryByMemberId(memberId);
    const councilHistory = getCouncilHistoryByMemberId(memberId);
    const contactHistory = getContactHistoryByMemberId(memberId);
    const currentParty = getCurrentPartyNameByMemberId(memberId, baseDate);
    const currentCommittees = buildCurrentCommitteeDisplayRows(memberId, baseDate);
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
    chunks.push(currentCommittees.regular.map(function (row) { return row.label; }).join(" "));
    chunks.push(currentCommittees.special.map(function (row) { return row.label; }).join(" "));
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

    specialCommitteeHistory.forEach(function (row) {
      chunks.push(row.meeting_name || "");
      chunks.push(row.special_committee_name || "");
      chunks.push(row.special_committee_type || "");
      chunks.push(row.role_name || "");
      chunks.push(row.member_note || "");
      chunks.push(row.instance_note || "");
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
    const committeeSelectorValue = (conditions.committee_selector || "").trim();
    const keyword = (conditions.keyword || "").trim().toLowerCase();

    return rows.filter(function (row) {
      const hitName = !name || String(row.member_name || "").toLowerCase().includes(name);

      const currentPartyRecord = getCurrentPartyRecordByMemberId(row.member_id, baseDate);
      const currentPartyId = currentPartyRecord ? currentPartyRecord.party_id : "";
      const hitParty = !partyId || currentPartyId === partyId;

      const hitCommittee = !committeeSelectorValue || hasCurrentCommittee(row.member_id, committeeSelectorValue, baseDate);

      const hitKeyword = !keyword || buildSearchTextForMember(row.member_id, baseDate).includes(keyword);

      return hitName && hitParty && hitCommittee && hitKeyword;
    });
  }

  function buildMemberDetail(memberId, baseDate) {
    const member = getMemberById(memberId);
    if (!member) return null;

    const currentContact = getCurrentContactRecordByMemberId(memberId, baseDate);

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

    const committeeHistoryRegular = getCommitteeHistoryByMemberId(memberId).map(function (row) {
      const committee = getCommitteeById(row.committee_id);
      return {
        start_date: row.start_date || "",
        end_date: row.end_date || "",
        committee_name: committee ? committee.committee_name : "",
        role_name: row.role_name || "",
        note: row.note || ""
      };
    });

    const committeeHistorySpecial = getSpecialCommitteeHistoryByMemberId(memberId).map(function (row) {
      return {
        meeting_name: row.meeting_name || "",
        special_committee_name: row.special_committee_name || "",
        role_name: row.role_name || "",
        start_date: row.member_start_date || "",
        end_date: row.member_end_date || "",
        established_date: row.established_date || "",
        note: row.member_note || row.instance_note || ""
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

    const currentCommittees = buildCurrentCommitteeDisplayRows(memberId, baseDate);

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
      current_committees_regular: currentCommittees.regular,
      current_committees_special: currentCommittees.special,
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
      office_terms: getOfficeTermsByMemberId(memberId),
      party_history: partyHistory,
      committee_history_regular: committeeHistoryRegular,
      committee_history_special: committeeHistorySpecial,
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
      member_councils: getArray("member_councils").length,
      meetings: getArray("meetings").length,
      special_committees: getArray("special_committees").length,
      special_committee_instances: getArray("special_committee_instances").length,
      special_committee_members: getArray("special_committee_members").length
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
