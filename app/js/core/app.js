window.APP_DATA = window.APP_DATA || {};

window.APP = (function () {
  "use strict";

  if (!window.APP_UTILS || !window.APP_UTILS.todayString || !window.APP_UTILS.isCurrentRange) {
    throw new Error("APP_UTILS is not loaded. Load js/core/utils.js before js/core/app.js.");
  }

  const todayString = window.APP_UTILS.todayString;
  const isCurrentRange = window.APP_UTILS.isCurrentRange;

  function getArray(name) {
    return Array.isArray(window.APP_DATA[name]) ? window.APP_DATA[name] : [];
  }

  function getMemberById(memberId) {
    return getArray("members").find(function (row) {
      return row.member_id === memberId;
    }) || null;
  }

  function getPartyById(partyId) {
    return getArray("parties").find(function (row) {
      return row.party_id === partyId;
    }) || null;
  }

  function getCommitteeById(committeeId) {
    return getArray("committees").find(function (row) {
      return row.committee_id === committeeId;
    }) || null;
  }

  function getCouncilById(councilId) {
    return getArray("councils").find(function (row) {
      return row.council_id === councilId;
    }) || null;
  }

  function getMeetingById(meetingId) {
    return getArray("meetings").find(function (row) {
      return row.meeting_id === meetingId;
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

  function roleOrder(roleName) {
    const role = String(roleName || "").trim();
    if (role === "委員長") return 1;
    if (role === "副委員長") return 2;
    return 9;
  }

  function getCurrentOfficeTermsByMemberId(memberId, baseDate) {
    return getArray("office_terms")
      .filter(function (row) {
        return row.member_id === memberId && isCurrentRange(row.term_start_date, row.term_end_date, baseDate);
      })
      .sort(function (a, b) {
        const as = a.term_start_date || "";
        const bs = b.term_start_date || "";
        return as < bs ? 1 : as > bs ? -1 : 0;
      });
  }

  function getCurrentStatusByMemberId(memberId, baseDate) {
    return getCurrentOfficeTermsByMemberId(memberId, baseDate).length > 0 ? "現職" : "過去在任";
  }

  function getOfficeTermsByMemberId(memberId) {
    return getArray("office_terms")
      .filter(function (row) {
        return row.member_id === memberId;
      })
      .sort(function (a, b) {
        const as = a.term_start_date || "";
        const bs = b.term_start_date || "";
        return as < bs ? 1 : as > bs ? -1 : 0;
      });
  }

  function getCurrentPartyRecordByMemberId(memberId, baseDate) {
    return getArray("member_parties")
      .filter(function (row) {
        return row.member_id === memberId && isCurrentRange(row.start_date, row.end_date, baseDate);
      })
      .sort(function (a, b) {
        const as = a.start_date || "";
        const bs = b.start_date || "";
        return as < bs ? 1 : as > bs ? -1 : 0;
      })[0] || null;
  }

  function getPartyHistoryByMemberId(memberId) {
    return getArray("member_parties")
      .filter(function (row) {
        return row.member_id === memberId;
      })
      .sort(function (a, b) {
        const as = a.start_date || "";
        const bs = b.start_date || "";
        return as < bs ? 1 : as > bs ? -1 : 0;
      })
      .map(function (row) {
        const party = getPartyById(row.party_id);
        return {
          start_date: row.start_date || "",
          end_date: row.end_date || "",
          party_name: party ? (party.party_name || "") : "",
          role_name: row.role_name || "",
          note: row.note || ""
        };
      });
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
        const as = a.start_date || "";
        const bs = b.start_date || "";
        return as < bs ? 1 : as > bs ? -1 : 0;
      })
      .map(function (row) {
        const committee = getCommitteeById(row.committee_id);
        return {
          start_date: row.start_date || "",
          end_date: row.end_date || "",
          committee_name: committee ? (committee.committee_name || "") : "",
          role_name: row.role_name || "",
          note: row.note || ""
        };
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
        const as = a.start_date || "";
        const bs = b.start_date || "";
        return as < bs ? 1 : as > bs ? -1 : 0;
      })
      .map(function (row) {
        const council = getCouncilById(row.council_id);
        return {
          start_date: row.start_date || "",
          end_date: row.end_date || "",
          council_name: council ? (council.council_name || "") : "",
          role_name: row.role_name || "",
          note: row.note || ""
        };
      });
  }

  function getCurrentContactRecordByMemberId(memberId, baseDate) {
    return getArray("contacts")
      .filter(function (row) {
        return row.member_id === memberId && isCurrentRange(row.start_date, row.end_date, baseDate);
      })
      .sort(function (a, b) {
        const as = a.start_date || "";
        const bs = b.start_date || "";
        return as < bs ? 1 : as > bs ? -1 : 0;
      })[0] || null;
  }

  function getContactHistoryByMemberId(memberId) {
    return getArray("contacts")
      .filter(function (row) {
        return row.member_id === memberId;
      })
      .sort(function (a, b) {
        const as = a.start_date || "";
        const bs = b.start_date || "";
        return as < bs ? 1 : as > bs ? -1 : 0;
      })
      .map(function (row) {
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
  }

  function getSpecialCommitteeJoinedRowsByMemberId(memberId) {
    return getArray("special_committee_members")
      .filter(function (row) {
        return row.member_id === memberId;
      })
      .map(function (row) {
        const instance = getSpecialCommitteeInstanceById(row.special_committee_instance_id);
        if (!instance) return null;

        const meeting = getMeetingById(instance.meeting_id);
        const specialCommittee = getSpecialCommitteeById(instance.special_committee_id);

        return {
          meeting_id: instance.meeting_id || "",
          meeting_name: meeting ? (meeting.session_name || "") : "",
          meeting_start_date: meeting ? (meeting.start_date || "") : "",
          special_committee_id: instance.special_committee_id || "",
          special_committee_name: specialCommittee ? (specialCommittee.special_committee_name || "") : "",
          established_date: instance.established_date || "",
          instance_end_date: instance.end_date || "",
          instance_note: instance.note || "",
          roster_file_path: instance.roster_file_path || "",
          role_name: row.role_name || "",
          member_start_date: row.start_date || "",
          member_end_date: row.end_date || "",
          member_note: row.note || ""
        };
      })
      .filter(Boolean);
  }

  function getCurrentSpecialCommitteeRowsByMemberId(memberId, baseDate) {
    return getSpecialCommitteeJoinedRowsByMemberId(memberId)
      .filter(function (row) {
        return isCurrentRange(row.member_start_date, row.member_end_date, baseDate) &&
               isCurrentRange(row.established_date, row.instance_end_date, baseDate);
      })
      .sort(function (a, b) {
        const as = a.established_date || "";
        const bs = b.established_date || "";
        if (as !== bs) return as < bs ? -1 : 1;
        const am = a.meeting_name || "";
        const bm = b.meeting_name || "";
        return am < bm ? -1 : am > bm ? 1 : 0;
      });
  }

  function getSpecialCommitteeHistoryByMemberId(memberId) {
    return getSpecialCommitteeJoinedRowsByMemberId(memberId)
      .sort(function (a, b) {
        const as = a.established_date || "";
        const bs = b.established_date || "";
        if (as !== bs) return as < bs ? 1 : -1;
        const am = a.meeting_name || "";
        const bm = b.meeting_name || "";
        return am < bm ? -1 : am > bm ? 1 : 0;
      })
      .map(function (row) {
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
  }

  function formatPartyLabel(partyName, roleName) {
    return roleName ? partyName + "（" + roleName + "）" : partyName;
  }

  function formatCommitteeLabel(committeeName, roleName) {
    return roleName ? committeeName + "（" + roleName + "）" : committeeName;
  }

  function formatCurrentSpecialCommitteeLabel(row) {
    const base = (row.meeting_name || "") + " / " + (row.special_committee_name || "");
    return row.role_name ? base + "（" + row.role_name + "）" : base;
  }

  function getCurrentPartyNameByMemberId(memberId, baseDate) {
    const current = getCurrentPartyRecordByMemberId(memberId, baseDate);
    if (!current) return "";
    const party = getPartyById(current.party_id);
    return party ? formatPartyLabel(party.party_name || "", current.role_name || "") : "";
  }

  function getCurrentCommitteeLabelsByMemberId(memberId, baseDate) {
    const regular = getCurrentCommitteeRecordsByMemberId(memberId, baseDate).map(function (row) {
      const committee = getCommitteeById(row.committee_id);
      return committee ? formatCommitteeLabel(committee.committee_name || "", row.role_name || "") : "";
    }).filter(Boolean);

    const special = getCurrentSpecialCommitteeRowsByMemberId(memberId, baseDate).map(function (row) {
      return formatCurrentSpecialCommitteeLabel(row);
    }).filter(Boolean);

    return {
      regular: regular,
      special: special
    };
  }

  function getCurrentCouncilLabelsByMemberId(memberId, baseDate) {
    return getCurrentCouncilRecordsByMemberId(memberId, baseDate)
      .map(function (row) {
        const council = getCouncilById(row.council_id);
        if (!council) return "";
        return row.role_name
          ? (council.council_name || "") + "（" + row.role_name + "）"
          : (council.council_name || "");
      })
      .filter(Boolean);
  }

  function getPartyOptions() {
    return getArray("parties")
      .filter(function (row) {
        return String(row.active_flag || "0") === "1";
      })
      .slice()
      .sort(function (a, b) {
        return Number(a.sort_order || 9999) - Number(b.sort_order || 9999);
      })
      .map(function (row) {
        return {
          party_id: row.party_id || "",
          party_name: row.party_name || ""
        };
      });
  }

  function getCommitteeOptions() {
    const regularOptions = getArray("committees")
      .filter(function (row) {
        return String(row.active_flag || "0") === "1";
      })
      .slice()
      .sort(function (a, b) {
        return Number(a.sort_order || 9999) - Number(b.sort_order || 9999);
      })
      .map(function (row) {
        return {
          value: "REGULAR:" + (row.committee_id || ""),
          label: row.committee_name || ""
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

  function hasCurrentCommittee(memberId, selectorValue, baseDate) {
    if (!selectorValue) return true;

    const parts = String(selectorValue).split(":");
    const type = parts[0] || "";
    const id = parts[1] || "";

    if (type === "REGULAR") {
      return getCurrentCommitteeRecordsByMemberId(memberId, baseDate).some(function (row) {
        return row.committee_id === id;
      });
    }

    if (type === "SPECIAL") {
      return getCurrentSpecialCommitteeRowsByMemberId(memberId, baseDate).some(function (row) {
        return row.special_committee_id === id;
      });
    }

    return true;
  }

  function buildMemberList(baseDate) {
    return getArray("members")
      .slice()
      .sort(function (a, b) {
        const ano = Number(a.member_no || 999999);
        const bno = Number(b.member_no || 999999);
        if (ano !== bno) return ano - bno;
        return (a.member_name || "") < (b.member_name || "") ? -1 : 1;
      })
      .map(function (member) {
        const currentCommittees = getCurrentCommitteeLabelsByMemberId(member.member_id, baseDate);
        return {
          member_id: member.member_id || "",
          member_no: member.member_no || "",
          member_name: member.member_name || "",
          current_status: getCurrentStatusByMemberId(member.member_id, baseDate),
          current_party_name: getCurrentPartyNameByMemberId(member.member_id, baseDate),
          current_committees_regular: currentCommittees.regular,
          current_committees_special: currentCommittees.special
        };
      });
  }

  function filterMemberList(rows, conditions, baseDate) {
    const name = (conditions.name || "").trim().toLowerCase();
    const partyId = (conditions.party_id || "").trim();
    const committeeSelector = (conditions.committee_selector || "").trim();
    const currentOnly = !!conditions.current_only;

    return rows.filter(function (row) {
      const hitCurrent = !currentOnly || row.current_status === "現職";

      const hitName =
        !name ||
        String(row.member_name || "").toLowerCase().includes(name);

      const currentParty = getCurrentPartyRecordByMemberId(row.member_id, baseDate);
      const currentPartyId = currentParty ? (currentParty.party_id || "") : "";
      const hitParty =
        !partyId ||
        currentPartyId === partyId;

      const hitCommittee =
        !committeeSelector ||
        hasCurrentCommittee(row.member_id, committeeSelector, baseDate);

      return hitCurrent && hitName && hitParty && hitCommittee;
    });
  }

  function getSummaryCounts() {
    return {
      members: getArray("members").length,
      office_terms: getArray("office_terms").length,
      member_parties: getArray("member_parties").length,
      member_committees: getArray("member_committees").length,
      member_councils: getArray("member_councils").length,
      contacts: getArray("contacts").length,
      meetings: getArray("meetings").length,
      special_committees: getArray("special_committees").length,
      special_committee_instances: getArray("special_committee_instances").length,
      special_committee_members: getArray("special_committee_members").length
    };
  }

  function buildMemberDetail(memberId, baseDate) {
    const member = getMemberById(memberId);
    if (!member) return null;

    const currentContact = getCurrentContactRecordByMemberId(memberId, baseDate);
    const currentCommittees = getCurrentCommitteeLabelsByMemberId(memberId, baseDate);

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
      party_history: getPartyHistoryByMemberId(memberId),
      committee_history_regular: getCommitteeHistoryByMemberId(memberId),
      committee_history_special: getSpecialCommitteeHistoryByMemberId(memberId),
      contact_history: getContactHistoryByMemberId(memberId),
      council_history: getCouncilHistoryByMemberId(memberId)
    };
  }

  return {
    todayString: todayString,
    buildMemberList: buildMemberList,
    filterMemberList: filterMemberList,
    getPartyOptions: getPartyOptions,
    getCommitteeOptions: getCommitteeOptions,
    getSummaryCounts: getSummaryCounts,
    buildMemberDetail: buildMemberDetail
  };
})();
