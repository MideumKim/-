// 주간 근무 시간표 입력 + 관리자 대시보드 + CSV 다운로드 + 미제출자 확인
"use client";

import { useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  setDoc,
  getDocs,
  collection,
  query,
  where,
} from "firebase/firestore";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-auth-domain",
  projectId: "your-project-id",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const weekdays = ["월요일", "화요일", "수요일", "목요일", "금요일"];
const hours = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
];

const knownUsers = ["김철수", "이영희", "박민준", "최수정"]; // ✅ 근무자 전체 명단 미제출자 체크용

export default function SchedulePage() {
  const [user, setUser] = useState(null);
  const [schedule, setSchedule] = useState({});
  const [viewMode, setViewMode] = useState("input");
  const [allData, setAllData] = useState([]);
  const [missingUsers, setMissingUsers] = useState([]);
  const weekKey = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  const toggleTime = (day, time) => {
    setSchedule((prev) => {
      const current = prev[day] || [];
      const updated = current.includes(time)
        ? current.filter((t) => t !== time)
        : [...current, time];
      return { ...prev, [day]: updated };
    });
  };

  const submitSchedule = async () => {
    if (!user) return;
    await setDoc(doc(db, "schedules", `${user.uid}_${weekKey}`), {
      uid: user.uid,
      name: user.displayName,
      week: weekKey,
      schedule,
      submittedAt: new Date().toISOString(),
    });
    alert("근무시간표가 저장되었습니다 ✅");
  };

  const fetchAllSchedules = async () => {
    const q = query(collection(db, "schedules"), where("week", "==", weekKey));
    const querySnapshot = await getDocs(q);
    const results = [];
    querySnapshot.forEach((doc) => results.push(doc.data()));
    setAllData(results);

    // 미제출자 확인
    const submittedNames = results.map((d) => d.name);
    const missing = knownUsers.filter((name) => !submittedNames.includes(name));
    setMissingUsers(missing);
  };

  const buildStats = () => {
    const stats = {};
    weekdays.forEach((d) => {
      stats[d] = {};
      hours.forEach((h) => {
        stats[d][h] = 0;
      });
    });
    allData.forEach((entry) => {
      for (const day in entry.schedule) {
        entry.schedule[day].forEach((time) => {
          stats[day][time]++;
        });
      }
    });
    return stats;
  };

  const exportCSV = () => {
    const rows = [
      ["이름", "요일", "시간"],
    ];
    allData.forEach((entry) => {
      for (const day in entry.schedule) {
        entry.schedule[day].forEach((time) => {
          rows.push([entry.name, day, time]);
        });
      }
    });
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `근무현황_${weekKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!user)
    return (
      <div className="p-6">
        <button onClick={login} className="bg-blue-600 text-white px-4 py-2 rounded">
          Google 로그인
        </button>
      </div>
    );

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <div>
          <strong>{user.displayName}</strong> 님 환영합니다.
        </div>
        <div className="space-x-2">
          <button onClick={() => setViewMode("input")} className="px-2 py-1 bg-gray-200 rounded">근무입력</button>
          <button onClick={() => { setViewMode("dashboard"); fetchAllSchedules(); }} className="px-2 py-1 bg-blue-100 rounded">관리자 대시보드</button>
          <button onClick={logout} className="px-2 py-1 bg-red-200 rounded">로그아웃</button>
        </div>
      </div>

      {viewMode === "input" && (
        <>
          <h2 className="text-lg font-bold mb-2">주간 근무 시간표 입력</h2>
          <div className="grid grid-cols-6 gap-2">
            <div></div>
            {weekdays.map((day) => (
              <div key={day} className="text-center font-semibold">{day}</div>
            ))}
            {hours.map((time) => (
              <>
                <div className="text-sm font-medium text-right pr-2">{time}</div>
                {weekdays.map((day) => (
                  <button key={day + time} onClick={() => toggleTime(day, time)} className={`border p-2 rounded text-sm ${schedule[day]?.includes(time) ? "bg-blue-500 text-white" : "bg-gray-100"}`}>{schedule[day]?.includes(time) ? "✔" : ""}</button>
                ))}
              </>
            ))}
          </div>
          <button onClick={submitSchedule} className="mt-6 bg-green-600 text-white px-4 py-2 rounded shadow">제출하기</button>
        </>
      )}

      {viewMode === "dashboard" && (
        <>
          <h2 className="text-lg font-bold mb-4">📊 주간 근무 현황</h2>
          <div className="mb-2 flex gap-2">
            <button onClick={exportCSV} className="bg-yellow-400 px-3 py-1 rounded">CSV 다운로드</button>
            <div className="text-sm text-gray-600">미제출자: {missingUsers.join(", ") || "없음"}</div>
          </div>
          <div className="grid grid-cols-6 gap-2 text-center">
            <div></div>
            {weekdays.map((d) => (
              <div key={d} className="font-semibold">{d}</div>
            ))}
            {hours.map((h) => (
              <>
                <div className="text-sm font-medium text-right pr-2">{h}</div>
                {weekdays.map((d) => {
                  const count = buildStats()[d][h];
                  return (
                    <div key={d + h} className={`p-2 rounded ${count > 0 ? "bg-green-100" : "bg-gray-100"}`}>{count}</div>
                  );
                })}
              </>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
