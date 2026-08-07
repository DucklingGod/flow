import { Plus, Trash2, WalletCards } from 'lucide-react'
import type { PortfolioAccount, WealthPlan } from '../domain/schema'

export function PortfolioAccounts({ plan, setPlan }: { plan: WealthPlan; setPlan: React.Dispatch<React.SetStateAction<WealthPlan>> }) {
  const patchAccount = (id: string, patch: Partial<PortfolioAccount>) => setPlan((current) => ({ ...current, portfolioAccounts: current.portfolioAccounts.map((account) => account.id === id ? { ...account, ...patch } : account) }))
  const addAccount = () => setPlan((current) => ({ ...current, portfolioAccounts: [...current.portfolioAccounts, { id: crypto.randomUUID(), name: 'บัญชีลงทุนใหม่', type: 'brokerage', currency: 'THB' }] }))
  return <div className="portfolio-accounts panel"><div><WalletCards /><span><b>บัญชีลงทุน</b><small>Holdings และ transactions อ้างอิง account ID เหล่านี้</small></span></div><div>{plan.portfolioAccounts.map((account) => {
    const inUse = plan.holdings.some((holding) => holding.accountId === account.id) || plan.transactions.some((tx) => tx.accountId === account.id)
    return <span key={account.id}><input aria-label="ชื่อบัญชีลงทุน" value={account.name} onChange={(event) => patchAccount(account.id, { name: event.target.value || 'บัญชีลงทุน' })} /><select aria-label="ประเภทบัญชีลงทุน" value={account.type} onChange={(event) => patchAccount(account.id, { type: event.target.value as PortfolioAccount['type'] })}><option value="brokerage">Brokerage</option><option value="fundPlatform">Fund platform</option><option value="retirement">Retirement</option><option value="cash">Cash</option></select><input aria-label="สกุลเงินบัญชี" maxLength={3} value={account.currency} onChange={(event) => patchAccount(account.id, { currency: event.target.value.toUpperCase().slice(0, 3) || 'THB' })} /><button disabled={inUse} title={inUse ? 'ย้าย holdings/transactions ออกจากบัญชีก่อน' : 'ลบบัญชี'} aria-label={`ลบ ${account.name}`} onClick={() => setPlan((current) => ({ ...current, portfolioAccounts: current.portfolioAccounts.filter((item) => item.id !== account.id) }))}><Trash2 /></button></span>
  })}<button onClick={addAccount}><Plus />เพิ่มบัญชี</button></div></div>
}
