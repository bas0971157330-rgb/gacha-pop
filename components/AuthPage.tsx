"use client";

import Link from "next/link";
import { Eye, EyeOff, LockKeyhole, LogIn, Mail, RotateCcw, ShieldCheck, User, UserPlus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { ensureMockDatabase, loginUser, registerUser, resetPasswordWithPin } from "@/data/mockDb";

type AuthMode = "login" | "register" | "forgot";

type AuthPageProps = {
  mode: AuthMode;
};

const termsSections = [
  {
    title: "1. ลักษณะการให้บริการ",
    items: [
      "ลูกค้าชำระเงินเพื่อสุ่มรับสินค้ากาชาปองตามรายการที่เว็บไซต์กำหนด",
      "การสุ่มเป็นระบบสุ่มตามรายการสินค้าที่มีอยู่จริงในตู้หรือเซ็ตนั้น",
      "ลูกค้าจะได้รับสินค้า 100% ทุกครั้งที่สุ่ม ไม่ใช่การลุ้นว่างเปล่า",
      "สินค้าที่ได้รับจะเป็นแบบสุ่ม ไม่สามารถเลือกแบบ สี รุ่น หรือลำดับได้ เว้นแต่มีระบุไว้ชัดเจนในรายการสินค้า",
    ],
  },
  {
    title: "2. ที่มาของสินค้า",
    items: [
      "สินค้าเป็นสินค้านำเข้าจากประเทศญี่ปุ่น อาจมาจากการประมูล การเหมาซื้อ หรือการจัดหาจากร้านค้าและแหล่งจำหน่ายในญี่ปุ่น",
      "สินค้าบางรายการอาจเป็นสินค้ามือหนึ่ง มือสอง หรือสินค้าสะสม ขึ้นอยู่กับรายละเอียดที่ระบุในหน้าเว็บ",
      "กล่อง แคปซูล ใบปิด หรือบรรจุภัณฑ์ อาจมีรอยพับ รอยขีดข่วน รอยบุบ หรือสภาพตามการขนส่งและการเก็บรักษา",
    ],
  },
  {
    title: "3. การสุ่มและผลลัพธ์",
    items: [
      "เมื่อกดยืนยันการสุ่มแล้ว ถือว่าลูกค้ายอมรับผลการสุ่ม",
      "ผลการสุ่มถือเป็นที่สิ้นสุด ไม่สามารถเปลี่ยนแบบสินค้าได้",
      "หากลูกค้าสุ่มได้สินค้าซ้ำ ถือเป็นส่วนหนึ่งของการสุ่มตามปกติ",
      "ร้านไม่รับประกันว่าจะได้รับตัวหายาก ตัวลับ หรือตัวที่ลูกค้าต้องการเป็นพิเศษ เว้นแต่มีระบุเป็นโปรโมชั่นเฉพาะ",
    ],
  },
  {
    title: "4. การชำระเงิน",
    items: [
      "ลูกค้าต้องชำระเงินเต็มจำนวนก่อนทำการสุ่ม",
      "คำสั่งซื้อจะสมบูรณ์เมื่อระบบยืนยันการชำระเงินเรียบร้อย",
      "หากชำระเงินผิดจำนวน กรุณาติดต่อร้านภายใน 24 ชั่วโมง พร้อมหลักฐานการโอน",
    ],
  },
  {
    title: "5. การจัดส่งสินค้า",
    items: [
      "ร้านจะจัดส่งสินค้าตามชื่อ ที่อยู่ และเบอร์โทรศัพท์ที่ลูกค้ากรอกไว้",
      "หากลูกค้ากรอกข้อมูลผิด ทำให้พัสดุตีกลับ สูญหาย หรือจัดส่งไม่สำเร็จ ลูกค้าเป็นผู้รับผิดชอบค่าจัดส่งซ้ำ",
      "ระยะเวลาจัดส่งขึ้นอยู่กับบริษัทขนส่งและพื้นที่ปลายทาง",
      "หลังส่งสินค้าแล้ว ร้านจะแจ้งเลขพัสดุให้ลูกค้าตรวจสอบ",
    ],
  },
  {
    title: "6. การเคลมสินค้า",
    items: [
      "แจ้งเคลมได้ภายใน 24 ชั่วโมงหลังได้รับสินค้า เฉพาะกรณีได้รับสินค้าไม่ตรงผลสุ่ม ได้รับสินค้าผิดรายการ สินค้าเสียหายรุนแรงจากความผิดพลาดของร้านก่อนจัดส่ง หรือพัสดุขาดหายจากการแพ็กของร้าน",
      "หลักฐานที่ต้องใช้ ได้แก่ คลิปวิดีโอขณะเปิดพัสดุตั้งแต่ก่อนแกะกล่องจนเห็นสินค้าครบถ้วน รูปถ่ายสินค้า รูปกล่องพัสดุ และเลขคำสั่งซื้อ",
    ],
  },
  {
    title: "7. กรณีที่ไม่รับเคลม",
    items: [
      "ไม่พอใจผลการสุ่ม สุ่มได้สินค้าซ้ำ หรือต้องการเปลี่ยนเป็นตัวอื่นหลังทราบผลสุ่มแล้ว",
      "บรรจุภัณฑ์มีรอยเล็กน้อย เช่น รอยบุบ รอยยับ รอยขีดข่วน",
      "สีหรือรายละเอียดสินค้าแตกต่างจากภาพเล็กน้อยจากแสง หน้าจอ หรือโรงงานผลิต",
      "ไม่มีคลิปวิดีโอเปิดพัสดุเป็นหลักฐาน หรือแจ้งเคลมเกินระยะเวลาที่กำหนด",
    ],
  },
  {
    title: "8. การยกเลิกและคืนเงิน",
    items: [
      "เมื่อชำระเงินและกดยืนยันสุ่มแล้ว ไม่สามารถยกเลิกคำสั่งซื้อได้",
      "ร้านจะคืนเงินเฉพาะกรณีสินค้าหมด ระบบผิดพลาด หรือร้านไม่สามารถจัดส่งสินค้าได้",
      "การคืนเงินจะดำเนินการผ่านช่องทางที่ลูกค้าใช้ชำระเงิน หรือช่องทางอื่นที่ร้านกำหนด",
    ],
  },
  {
    title: "9. ข้อจำกัดความรับผิดชอบ",
    items: [
      "ร้านไม่รับผิดชอบความล่าช้าที่เกิดจากบริษัทขนส่ง ภัยธรรมชาติ เหตุสุดวิสัย หรือข้อมูลจัดส่งไม่ถูกต้องจากลูกค้า",
      "ร้านไม่รับผิดชอบความเสียหายที่เกิดหลังลูกค้าได้รับสินค้าแล้ว",
      "หากเกิดปัญหาจากระบบ ร้านจะตรวจสอบข้อมูลคำสั่งซื้อและพิจารณาแก้ไขตามความเหมาะสม",
    ],
  },
  {
    title: "10. การยอมรับเงื่อนไข",
    items: [
      "การสมัครสมาชิก การชำระเงิน หรือการกดยืนยันสุ่ม ถือว่าลูกค้าได้อ่าน เข้าใจ และยอมรับเงื่อนไขทั้งหมดแล้ว",
      "ร้านขอสงวนสิทธิ์ในการแก้ไข เปลี่ยนแปลง หรือเพิ่มเติมเงื่อนไขโดยไม่ต้องแจ้งให้ทราบล่วงหน้า",
    ],
  },
];

function getPasswordStrength(password: string) {
  const checks = [
    password.length >= 8,
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^a-zA-Z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const labels = ["ยังอ่อนมาก", "อ่อน", "พอใช้", "ดี", "แข็งแรง", "แข็งแรงมาก"];
  return { score, label: labels[score] };
}

export function AuthPage({ mode }: AuthPageProps) {
  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement | null>(null);
  const submittingRef = useRef(false);
  const submitAuthRef = useRef<() => void>(() => undefined);

  const strength = useMemo(() => getPasswordStrength(password), [password]);
  const title = mode === "login" ? "ยินดีต้อนรับกลับ!" : mode === "register" ? "สมัครสมาชิก" : "ลืมรหัสผ่าน";
  const subtitle =
    mode === "login"
      ? "เข้าสู่ระบบเพื่อสนุกกับการสุ่มกาชาปอง"
      : mode === "register"
        ? "สร้างบัญชี Gacha Pop ของคุณ"
        : "ยืนยัน PIN 6 หลักแล้วตั้งรหัสผ่านใหม่";

  useEffect(() => {
    ensureMockDatabase();
  }, []);

  useEffect(() => {
    if (mode !== "register") {
      setAcceptedTerms(false);
      setShowTerms(false);
    }
  }, [mode]);

  useEffect(() => {
    const handler = (event: TouchEvent | MouseEvent) => {
      const point = "touches" in event ? event.touches[0] : event;
      if (!point) return;

      console.log("TOUCH_TARGET", event.target);
      console.log("ELEMENTS_FROM_POINT", document.elementsFromPoint(point.clientX, point.clientY));
    };

    document.addEventListener("touchstart", handler, true);
    document.addEventListener("click", handler, true);

    return () => {
      document.removeEventListener("touchstart", handler, true);
      document.removeEventListener("click", handler, true);
    };
  }, []);

  function resetFeedback() {
    setError("");
    setMessage("");
  }

  function goAfterAuth(path: string) {
    window.dispatchEvent(new Event("gacha-auth-updated"));
    window.location.assign(path);
  }

  async function submitAuth() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    resetFeedback();
    setLoading(true);

    try {
      if (mode === "login") {
        if (!identifier.trim() || !password) throw new Error("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
        await loginUser(identifier.trim(), password, remember);
        goAfterAuth("/");
        return;
      }

      if (mode === "register") {
        if (!acceptedTerms) throw new Error("กรุณายอมรับเงื่อนไขและข้อตกลงก่อนสมัครสมาชิก");
        if (!username.trim() || !email.trim() || !pin || !password || !confirmPassword) throw new Error("กรุณากรอกข้อมูลสมัครสมาชิกให้ครบ");
        if (!/^[a-zA-Z0-9_-]{5,20}$/.test(username)) throw new Error("ชื่อผู้ใช้ต้องเป็น a-z, A-Z, 0-9, _ หรือ - ความยาว 5-20 ตัวอักษร");
        if (!/^\d{6}$/.test(pin)) throw new Error("PIN ต้องเป็นตัวเลข 6 หลัก");
        if (strength.score < 3) throw new Error("กรุณาตั้งรหัสผ่านให้ปลอดภัยมากขึ้น");
        if (password !== confirmPassword) throw new Error("รหัสผ่านยืนยันไม่ตรงกัน");
        await registerUser({ username, email, pin, password });
        goAfterAuth("/");
        return;
      }

      if (!/^\d{6}$/.test(pin)) throw new Error("PIN ต้องเป็นตัวเลข 6 หลัก");
      if (strength.score < 3) throw new Error("กรุณาตั้งรหัสผ่านใหม่ให้ปลอดภัยมากขึ้น");
      if (password !== confirmPassword) throw new Error("รหัสผ่านยืนยันไม่ตรงกัน");
      await resetPasswordWithPin(identifier, pin, password);
      setMessage("ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว เข้าสู่ระบบได้เลย");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  submitAuthRef.current = () => {
    void submitAuth();
  };

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    const handler = (event: SubmitEvent) => {
      event.preventDefault();
      console.log(mode === "login" ? "LOGIN_NATIVE_FORM_SUBMIT" : mode === "register" ? "REGISTER_NATIVE_FORM_SUBMIT" : "FORGOT_NATIVE_FORM_SUBMIT");
      submitAuthRef.current();
    };

    form.addEventListener("submit", handler);

    return () => {
      form.removeEventListener("submit", handler);
    };
  }, [mode]);

  function handleAuthFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    console.log(mode === "login" ? "LOGIN_FORM_SUBMIT" : mode === "register" ? "REGISTER_FORM_SUBMIT" : "FORGOT_FORM_SUBMIT");
    void submitAuth();
  }

  return (
    <main className="auth-page">
      <div className="auth-orb auth-orb-a" />
      <div className="auth-orb auth-orb-b" />
      <section className="auth-card">
        <div className="auth-card-head">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <Logo />
        </div>

        <div className="auth-tabs" aria-label="เมนูสมาชิก">
          <Link href="/login" className={mode === "login" ? "auth-tab auth-tab-active" : "auth-tab"}>
            เข้าสู่ระบบ
          </Link>
          <Link href="/register" className={mode === "register" ? "auth-tab auth-tab-active" : "auth-tab"}>
            สมัครสมาชิก
          </Link>
        </div>

        <form
          ref={formRef}
          className="auth-form"
          method="post"
          action={mode === "login" ? "/login" : mode === "register" ? "/register" : "/forgot-password"}
          onSubmit={handleAuthFormSubmit}
        >
          {mode === "register" ? (
            <>
              <label className="auth-field">
                <span>ชื่อผู้ใช้</span>
                <div>
                  <User size={19} />
                  <input name="gacha-register-username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="ชื่อผู้ใช้งาน" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} required />
                </div>
                <small>ใช้ได้เฉพาะ a-z, A-Z, 0-9, _ และ - ความยาว 5-20 ตัวอักษร</small>
              </label>
              <label className="auth-field">
                <span>อีเมล</span>
                <div>
                  <Mail size={19} />
                  <input name="gacha-register-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email@example.com" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} required />
                </div>
              </label>
            </>
          ) : (
            <label className="auth-field">
              <span>อีเมล หรือ ชื่อผู้ใช้</span>
              <div>
                <User size={19} />
                <input name="gacha-login-identifier" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="กรอกอีเมลหรือชื่อผู้ใช้" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} required />
              </div>
            </label>
          )}

          {(mode === "register" || mode === "forgot") && (
            <label className="auth-field">
              <span>PIN 6 หลัก</span>
              <div>
                <ShieldCheck size={19} />
                <input name="gacha-pin" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" inputMode="numeric" autoComplete="off" required />
              </div>
              <small className={pin.length === 6 ? "auth-ok" : "auth-danger"}>{pin.length === 6 ? "PIN ครบ 6 หลัก" : "ต้องมีจำนวน 6 ตัวอักษร"}</small>
            </label>
          )}

          <label className="auth-field">
            <span>{mode === "forgot" ? "รหัสผ่านใหม่" : "รหัสผ่าน"}</span>
            <div>
              <LockKeyhole size={19} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="กรอกรหัสผ่าน"
                name="gacha-password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                data-lpignore="true"
                required
              />
              <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label="แสดงรหัสผ่าน">
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
          </label>

          {(mode === "register" || mode === "forgot") && (
            <>
              <label className="auth-field">
                <span>ยืนยันรหัสผ่านอีกครั้ง</span>
                <div>
                  <LockKeyhole size={19} />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="ยืนยันรหัสผ่าน"
                    name="gacha-confirm-password"
                    autoComplete="new-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    data-lpignore="true"
                    required
                  />
                  <button type="button" onClick={() => setShowConfirmPassword((current) => !current)} aria-label="แสดงรหัสผ่านยืนยัน">
                    {showConfirmPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
              </label>
              <div className="auth-strength">
                <span>ความปลอดภัยของรหัสผ่าน / Password strength</span>
                <div>
                  <i style={{ width: `${Math.max(6, strength.score * 20)}%` }} />
                </div>
                <small>{strength.label}</small>
              </div>
            </>
          )}

          {mode === "login" && (
            <div className="auth-row">
              <label>
                <input name="gacha-remember" type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                จดจำการเข้าสู่ระบบ
              </label>
              <Link href="/forgot-password">ลืมรหัสผ่าน?</Link>
            </div>
          )}

          {mode === "register" && (
            <div className="auth-terms-row">
              <label>
                <input
                  name="gacha-accept-terms"
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(event) => setAcceptedTerms(event.target.checked)}
                  required
                />
                <span>ฉันยอมรับ</span>
              </label>
              <button type="button" className="auth-terms-link" onClick={() => setShowTerms(true)}>
                เงื่อนไขและข้อตกลง
              </button>
            </div>
          )}

          {error && <p className="auth-alert auth-alert-error">{error}</p>}
          {message && <p className="auth-alert auth-alert-success">{message}</p>}

          <button
            type="submit"
            className="auth-submit"
            disabled={loading || (mode === "register" && !acceptedTerms)}
            onClick={() => console.log(mode === "login" ? "LOGIN_BUTTON_CLICK" : mode === "register" ? "REGISTER_BUTTON_CLICK" : "FORGOT_BUTTON_CLICK")}
          >
            {mode === "login" ? <LogIn size={22} /> : mode === "register" ? <UserPlus size={22} /> : <RotateCcw size={22} />}
            {loading ? "กำลังดำเนินการ..." : mode === "login" ? "เข้าสู่ระบบ" : mode === "register" ? "สมัครสมาชิก" : "ตั้งรหัสผ่านใหม่"}
          </button>
        </form>

        <p className="auth-footer">
          {mode === "login" ? (
            <>
              ยังไม่มีบัญชี? <Link href="/register">สมัครสมาชิก</Link>
            </>
          ) : (
            <>
              ถ้ามีบัญชีแล้ว <Link href="/login">เข้าสู่ระบบเลย!</Link>
            </>
          )}
        </p>
      </section>

      {showTerms && (
        <div className="auth-terms-backdrop" onClick={() => setShowTerms(false)}>
          <section className="auth-terms-modal" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="auth-terms-close" onClick={() => setShowTerms(false)} aria-label="ปิดเงื่อนไข">
              <X size={22} />
            </button>
            <div className="auth-terms-head">
              <h2>เงื่อนไขและข้อตกลงการใช้บริการสุ่มกาชาปอง</h2>
              <p>
                เว็บไซต์นี้ให้บริการสุ่มกาชาปองสินค้านำเข้าจากประเทศญี่ปุ่น โดยสินค้าทุกชิ้นเป็นสินค้าที่ได้จากหน้าตู้กาชาปองจริง
                หรือสินค้ากาชาปองที่ประมูล/จัดหามาจากประเทศญี่ปุ่น
              </p>
            </div>
            <div className="auth-terms-body">
              {termsSections.map((section) => (
                <article key={section.title}>
                  <h3>{section.title}</h3>
                  <ol>
                    {section.items.map((item, index) => (
                      <li key={`${section.title}-${index}`}>{item}</li>
                    ))}
                  </ol>
                </article>
              ))}
            </div>
            <button
              type="button"
              className="auth-terms-accept"
              onClick={() => {
                setAcceptedTerms(true);
                setShowTerms(false);
              }}
            >
              ยอมรับเงื่อนไข
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
