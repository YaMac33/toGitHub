window.APP_DATA = window.APP_DATA || {};

(function () {

  function get(name) {
    return window.APP_DATA[name] || [];
  }

  function byMeeting(meetingId) {
    return get("special_committee_instances")
      .filter(x => x.meeting_id === meetingId);
  }

  function getSC(id) {
    return get("special_committees")
      .find(x => x.special_committee_id === id);
  }

  function getMembers(instanceId) {
    return get("special_committee_members")
      .filter(x => x.special_committee_instance_id === instanceId);
  }

  function getMember(id) {
    return get("members").find(x => x.member_id === id);
  }

  function renderList() {
    const list = document.getElementById("list");
    const meetings = get("meetings");

    list.innerHTML = meetings.map(m => {
      const count = byMeeting(m.meeting_id).length;
      return `
        <div class="row" data-id="${m.meeting_id}">
          ${m.session_name}
          <br>
          ${m.session_type} / 特別委員会:${count}
        </div>
      `;
    }).join("");

    document.querySelectorAll(".row").forEach(el => {
      el.onclick = () => {
        document.querySelectorAll(".row").forEach(r => r.classList.remove("selected"));
        el.classList.add("selected");
        renderDetail(el.dataset.id);
      };
    });
  }

  function renderDetail(meetingId) {
    const detail = document.getElementById("detail");

    const meeting = get("meetings").find(x => x.meeting_id === meetingId);
    const instances = byMeeting(meetingId);

    let html = `
      <div class="section">
        <div class="title">${meeting.session_name}</div>
        <div>${meeting.start_date} ～ ${meeting.end_date}</div>
      </div>
    `;

    instances.forEach(inst => {
      const sc = getSC(inst.special_committee_id);
      const members = getMembers(inst.special_committee_instance_id);

      html += `
        <div class="section">
          <div class="title">${sc.special_committee_name}</div>
          <div>設置: ${inst.established_date}</div>
          <div>終了: ${inst.end_date || "継続中"}</div>
          <div>
            ${members.map(m => {
              const mem = getMember(m.member_id);
              return `<span class="pill">${mem.member_name} (${m.role_name})</span>`;
            }).join("")}
          </div>
        </div>
      `;
    });

    detail.innerHTML = html;
  }

  document.addEventListener("DOMContentLoaded", renderList);

})();
