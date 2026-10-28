import { useState, useEffect } from 'react'
import PocketBase from 'pocketbase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const pb = new PocketBase('/')

const statusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  qualified: 'bg-green-100 text-green-800',
  converted: 'bg-purple-100 text-purple-800',
  lost: 'bg-gray-100 text-gray-800',
}

const statusLabels: Record<string, string> = {
  new: 'Novo',
  contacted: 'Contatado',
  qualified: 'Qualificado',
  converted: 'Convertido',
  lost: 'Perdido',
}

interface Lead {
  id: string
  name: string
  phone: string
  email: string
  interest: string
  preferred_date: string
  category: string
  doctor: string
  source: string
  status: string
  created: string
  conversation_id: string
}

export default function LeadsPipeline() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

  useEffect(() => {
    loadLeads()
  }, [])

  async function loadLeads() {
    setLoading(true)
    setError('')
    try {
      const records = await pb.collection('leads').getList(1, 100, {
        sort: '-created',
        requestKey: 'leads-list',
      })
      setLeads(records.items as unknown as Lead[])
    } catch (e: any) {
      setError('Erro ao carregar leads. Faca login como admin.')
    }
    setLoading(false)
  }

  async function updateStatus(id: string, newStatus: string) {
    try {
      await pb.collection('leads').update(id, { status: newStatus })
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status: newStatus } : l)))
      if (selectedLead?.id === id) setSelectedLead({ ...selectedLead, status: newStatus })
    } catch (e) {
      alert('Erro ao atualizar status. Faca login como admin.')
    }
  }

  const filtered = leads.filter((l) => {
    if (search) {
      const q = search.toLowerCase()
      if (
        !l.name?.toLowerCase().includes(q) &&
        !l.phone?.includes(q) &&
        !l.email?.toLowerCase().includes(q)
      )
        return false
    }
    if (statusFilter && l.status !== statusFilter) return false
    return true
  })

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pipeline de Leads</h1>
          <p className="text-sm text-muted-foreground">
            {leads.length} lead{leads.length !== 1 ? 's' : ''} capturado
            {leads.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="outline" onClick={loadLeads} disabled={loading}>
          {loading ? 'Carregando...' : 'Atualizar'}
        </Button>
      </div>

      {error && (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardContent className="p-4 text-yellow-800">{error}</CardContent>
        </Card>
      )}

      <div className="flex gap-4">
        <Input
          placeholder="Buscar por nome, telefone ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm"
        >
          <option value="">Todos os status</option>
          {Object.entries(statusLabels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Data/Horario</TableHead>
                <TableHead>Interesse</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Médico</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Nenhum lead encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((lead) => (
                  <TableRow
                    key={lead.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedLead(lead)}
                  >
                    <TableCell className="font-medium">{lead.name}</TableCell>
                    <TableCell>{lead.phone}</TableCell>
                    <TableCell>{lead.email}</TableCell>
                    <TableCell>{lead.preferred_date || '-'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{lead.interest || '-'}</TableCell>
                    <TableCell>{lead.category || '-'}</TableCell>
                    <TableCell>{lead.doctor || '-'}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[lead.status] || ''}>
                        {statusLabels[lead.status] || lead.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(lead.created).toLocaleDateString('pt-BR')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedLead && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Detalhes do Lead</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setSelectedLead(null)}>
              Fechar
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">Nome</label>
                <p className="font-medium">{selectedLead.name}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Telefone</label>
                <p>{selectedLead.phone || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Email</label>
                <p>{selectedLead.email || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Data/Horario Preferido</label>
                <p>{selectedLead.preferred_date || '-'}</p>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Interesse</label>
                <p>{selectedLead.interest || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Categoria</label>
                <p>{selectedLead.category || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Médico</label>
                <p>{selectedLead.doctor || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Origem</label>
                <p>{selectedLead.source || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Conversa</label>
                <p className="text-xs font-mono">{selectedLead.conversation_id || '-'}</p>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Status</label>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(statusLabels).map(([k, v]) => (
                  <Button
                    key={k}
                    size="sm"
                    variant={selectedLead.status === k ? 'default' : 'outline'}
                    onClick={() => updateStatus(selectedLead.id, k)}
                  >
                    {v}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
