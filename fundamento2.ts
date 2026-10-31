interface Pagament {
    status: 'pendente'|'pago'|'cancelado',
    pagoEm?: Date,
    idTransacao?:string,
    motivoCancelamento?:string
}

/*
    Liste três estados inválidos:
    1.     
    status:"pendente",
    idTransacao:1001,
    motivoCancelamento:"desistencia",
    2.     
    status:"pago",
    idTransacao:1002,
    motivoCancelamento:"compra errada",
    3.     
    status:"cancelado",
    pagoEm:2000/02/11,
    idTransacao:1003,
*/

type PagamentState = 
    |{ status:'pendente' }
    |{ status:'pago' , pagoEm: Date , idTransacao: string }
    |{ status:'cancelado' , motivoCancelamento:string}
// isso importa porque com o codigo acima impede casos que nao deviam existir como nos tres estados invalidos anteriores

function descrever(p: PagamentState):string{
    switch(p.status){
        case 'pendente':
            return 'Status: pendente';
        case 'pago':
            return `Status: pago, Pago em ${p.pagoEm.toISOString()}, ID transação: ${p.idTransacao}`;
        case 'cancelado':
            return `Status: cancelado, Motivo do cancelamento: ${p.motivoCancelamento}`;
        default:{
            const _exaustivo: never = p;
            return _exaustivo;
        }
    }
}

type Resultado<T> = 
    |{'ok':true,'valor':T} 
    |{'ok':false,'erro':string}

type DataValida = Date & {readonly __marca : 'DataValida'};

function criarDataValida(d:Date): Resultado<DataValida> {
  if(Number.isNaN(d.getTime())){
    return {'ok':false,'erro':'Formato de data inválido'}
  }
  const date = new Date(d.getTime())
  return {'ok':true,'valor':date as DataValida}
}

const r = new Date();
const d = criarDataValida(r); 

if (d.ok) { 
    r.setTime(NaN); 
    console.log(d.valor)
}
