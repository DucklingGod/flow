import { Component, type ErrorInfo, type ReactNode } from 'react'
import { createSafeDiagnostic, type SafeDiagnostic } from '../domain/diagnostics'

interface State { diagnostic: SafeDiagnostic | null }

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { diagnostic: null }

  static getDerivedStateFromError(error: unknown) { return { diagnostic: createSafeDiagnostic(error, window.location.hash) } }

  componentDidCatch(_error: unknown, _info: ErrorInfo) {
    console.error('Flow render boundary', this.state.diagnostic)
  }

  render() {
    if (!this.state.diagnostic) return this.props.children
    return <main className="fatal-boundary"><div><span>LOCAL RECOVERY</span><h1>หน้านี้แสดงผลไม่สำเร็จ</h1><p>ข้อมูลของคุณยังอยู่ใน browser และไม่ได้ถูกส่งออกไป ระบบบันทึกเฉพาะชนิด error กับชื่อหน้าจอ โดยไม่เก็บข้อความ error หรือค่าการเงิน</p><code>{this.state.diagnostic.id} · {this.state.diagnostic.errorType} · {this.state.diagnostic.route}</code><button onClick={() => window.location.reload()}>โหลดแอปใหม่</button></div></main>
  }
}
