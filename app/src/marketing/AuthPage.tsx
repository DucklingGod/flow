import { ArrowLeft, DatabaseBackup, Lock, ShieldCheck } from 'lucide-react'
import { SignIn, SignUp } from '@clerk/clerk-react'
import { authConfigured, useClerkReady } from '../auth/sessionContext'
import './marketing.css'

const assurances = [
  { icon: Lock, text: 'แผนการเงินของคุณถูกเก็บในเครื่อง ไม่ได้อัปโหลดขึ้น server เมื่อสมัคร' },
  { icon: ShieldCheck, text: 'Flow ไม่เชื่อมต่อโบรกเกอร์หรือธนาคาร และไม่ทำรายการแทนคุณ' },
  { icon: DatabaseBackup, text: 'สำรองข้อมูลแบบเข้ารหัสด้วยรหัสผ่านที่มีเพียงคุณเท่านั้นที่รู้' },
]

function AuthShell({ mode, children }: { mode: 'signIn' | 'signUp'; children: React.ReactNode }) {
  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <a className="auth-brand" href="/">
          <img src="/flow-logo-optimized.png" alt="" />
          <span><strong>flow.</strong><small>wealth studio</small></span>
        </a>
        <div className="auth-aside-copy">
          <h1>{mode === 'signUp' ? 'เริ่มออกแบบความมั่งคั่งของคุณ' : 'ยินดีต้อนรับกลับมา'}</h1>
          <p>
            {mode === 'signUp'
              ? 'สร้างบัญชีเพื่อซิงก์แผนข้ามอุปกรณ์แบบเข้ารหัส และปลดล็อกเครื่องมือวางแผนเชิงลึก'
              : 'เข้าสู่ระบบเพื่อเปิดแผนของคุณและซิงก์ต่อจากอุปกรณ์เดิม'}
          </p>
        </div>
        <ul className="auth-assurances">
          {assurances.map(({ icon: Icon, text }) => <li key={text}><Icon />{text}</li>)}
        </ul>
        <a className="auth-back" href="/"><ArrowLeft />กลับหน้าแรก</a>
      </aside>

      <main className="auth-main">
        <a className="auth-back mobile" href="/"><ArrowLeft />กลับหน้าแรก</a>
        {children}
      </main>
    </div>
  )
}

/**
 * Shown when the build has no Clerk publishable key. The planner itself still
 * works offline, so this explains the state rather than pretending to be a
 * broken sign-in form.
 */
function AuthUnconfigured({ mode }: { mode: 'signIn' | 'signUp' }) {
  return (
    <AuthShell mode={mode}>
      <div className="auth-unconfigured panel">
        <span className="eyebrow">LOCAL-ONLY BUILD</span>
        <h2>บิลด์นี้ยังไม่ได้ตั้งค่าระบบบัญชี</h2>
        <p>
          ยังไม่ได้กำหนดค่า <code>VITE_CLERK_PUBLISHABLE_KEY</code> สำหรับบิลด์นี้ ระบบสมัครและเข้าสู่ระบบจึงยังไม่เปิดใช้งาน
        </p>
        <p>คุณยังใช้ Flow ได้เต็มรูปแบบแบบออฟไลน์ ข้อมูลทั้งหมดจะถูกเก็บไว้ในเครื่องนี้</p>
        <a className="auth-open-app" href="/#/studio">เปิดแอปแบบ local</a>
        <p className="auth-alt-link">
          {mode === 'signUp'
            ? <>มีบัญชีอยู่แล้ว? <a href="/sign-in">เข้าสู่ระบบ</a></>
            : <>ยังไม่มีบัญชี? <a href="/sign-up">สมัครใช้งาน</a></>}
        </p>
      </div>
    </AuthShell>
  )
}

/**
 * Placeholder shown while the lazily loaded ClerkProvider chunk arrives.
 * Rendering `<SignIn>`/`<SignUp>` before the provider mounts throws, so the
 * shell paints first and the form follows.
 */
function AuthLoading() {
  return <div className="auth-loading panel" role="status">กำลังเตรียมแบบฟอร์ม…</div>
}

export function SignInPage() {
  const clerkReady = useClerkReady()
  if (!authConfigured) return <AuthUnconfigured mode="signIn" />
  return (
    <AuthShell mode="signIn">
      {clerkReady
        ? <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" forceRedirectUrl="/#/studio" />
        : <AuthLoading />}
    </AuthShell>
  )
}

export function SignUpPage() {
  const clerkReady = useClerkReady()
  if (!authConfigured) return <AuthUnconfigured mode="signUp" />
  return (
    <AuthShell mode="signUp">
      {clerkReady
        ? <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" forceRedirectUrl="/#/studio" />
        : <AuthLoading />}
    </AuthShell>
  )
}
