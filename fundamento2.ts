/**
 * Tornar estados inválidos irrepresentáveis.
 */

interface Pagamento {
    // Propriedades opcionais permitem combinações incoerentes entre os estados.
    // Por exemplo, um pagamento pendente pode carregar uma transação e um motivo.
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

// A união discriminada faz de status o discriminante e descreve cada estado
// com apenas os dados que podem existir nele.
type PagamentState = 
    |{ status:'pendente' }
    |{ status:'pago' , pagoEm: Date , idTransacao: string }
    |{ status:'cancelado' , motivoCancelamento:string}

// Isso importa porque a união discriminada impede os estados inválidos listados anteriormente.

function descrever(p: PagamentState):string{
    switch(p.status){
        case 'pendente':
            return 'Status: pendente';
        case 'pago':
            return `Status: pago, Pago em ${p.pagoEm.toISOString()}, ID transação: ${p.idTransacao}`;
        case 'cancelado':
            return `Status: cancelado, Motivo do cancelamento: ${p.motivoCancelamento}`;
        default:{
            // Se uma nova variante for adicionada e não for tratada acima,
            // p deixará de ser never e o compilador apontará este ponto.
            const _exaustivo: never = p;
            return _exaustivo;
        }
    }
}

// Resultado<T> representa explicitamente sucesso ou falha, sem misturar os
// dois formatos em um objeto parcialmente preenchido.
type Resultado<T> = 
    |{'ok':true,'valor':T} 
    |{'ok':false,'erro':string}

// A marca nominal orienta o compilador a distinguir uma data validada de uma
// Date comum. Ela não valida dados em runtime nem torna Date imutável.
type DataValida = Date & { readonly __marca: 'DataValida' };

function criarDataValida(d:Date): Resultado<DataValida> {
    // A verificação acontece em runtime; a asserção abaixo só informa o tipo ao
    // compilador depois que a função estabeleceu esse contrato.
  if(Number.isNaN(d.getTime())){
    return {'ok':false,'erro':'Formato de data inválido'}
  }
    // Clona a data para que alterações posteriores no objeto original não a invalidem.
    const date = new Date(d.getTime())
  return {'ok':true,'valor':date as DataValida}
}

const r = new Date();
const d = criarDataValida(r); 

// O discriminante ok estreita d para a variante de sucesso neste bloco.
if (d.ok) { 
    // r pode ser alterada sem invalidar d.valor porque a função criou uma cópia.
    r.setTime(NaN); 
    console.log(d.valor)
}
