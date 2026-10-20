// Firebase 웹 설정값은 공개되어도 되는 값입니다.
// 실제 보안은 firestore.rules(보안 규칙)에서 지킵니다.
export const firebaseConfig = {
  apiKey: "AIzaSyDyFIu-NCoUUUkB2HSzuxkOqpHk98B52cQ",
  authDomain: "umasi-116cc.firebaseapp.com",
  projectId: "umasi-116cc",
  storageBucket: "umasi-116cc.firebasestorage.app",
  messagingSenderId: "7471683778",
  appId: "1:7471683778:web:072ac159d428746520c35b",
  measurementId: "G-1D9WCV0PCF"
};

// 학급 구분용 ID. 다른 반에서 같이 쓰려면 이 값만 바꿔 배포하면 데이터가 분리됩니다.
export const CLASS_ID = "umasi-class";

// 선생님 관리 화면을 열 수 있는 Google 계정 (소문자).
// 바꾸면 firestore.rules 의 teacherEmails() 목록도 똑같이 바꿔야 합니다.
export const TEACHER_EMAILS = ["design013@nyschool.co.kr"];

// 이전 버전(한 문서에 모두 저장하던 방식) 데이터 위치 — 가져오기 기능에서만 사용
export const LEGACY_APP_ID = "umasi-class";
