// O service worker: o pedaço do AVANEST que continua vivo com o app fechado.
//
// Ele roda fora da página, sem acesso à tela nem ao que estava aberto. Só
// acorda quando o sistema o chama — e aqui, por dois motivos: chegou uma
// notificação, ou alguém tocou numa.
//
// O QUE ELE GUARDA EM CACHE, E O QUE NUNCA GUARDA. A regra é uma só, e a
// linha que ela traça não é entre "rápido" e "lento" — é entre ARQUIVO e DADO:
//
//   GUARDA os arquivos de build: /_next/static/... e os ícones. São gerados
//   pelo compilador com o conteúdo no nome (…/chunks/0dty8r1y3.1p2.css), e a
//   Vercel os serve como `immutable`. Mudou o conteúdo, mudou o endereço —
//   então um arquivo guardado NUNCA está velho: ou é exatamente o que a
//   página pediu, ou a página pediu outro endereço.
//
//   NUNCA guarda página nem API. Um service worker que serve HTML salvo é o
//   jeito mais fácil de um sistema clínico mostrar a escala do mês passado
//   como se fosse a de hoje, sem ninguém perceber. Escala, agenda, avaliação e
//   financeiro são DADO: mudam sem mudar de endereço, e a única resposta certa
//   para eles é a que vem do servidor agora.
//
// É essa distinção que torna o cache seguro aqui. Sem ela, a resposta certa
// seria a de antes: não guardar nada.
//
// ESTE ARQUIVO É SERVIDO CRU. Não passa pelo compilador do Next, então nada de
// TypeScript, nada de import — só JavaScript que o navegador entende sozinho.

// Assume o controle sem esperar a aba ser fechada e reaberta. Sem isto, a
// primeira versão instalada fica no ar até a pessoa fechar todas as abas do
// site — e uma correção aqui demoraria dias para chegar em quem deixa o
// sistema aberto o dia inteiro.
self.addEventListener("install", () => self.skipWaiting());

/** Onde os arquivos de build ficam guardados. */
const DEPOSITO = "avanest-arquivos-v1";

/**
 * Este endereço é um ARQUIVO DE BUILD, ou é dado?
 *
 * Fica separada, e com nome, porque é a única linha de código deste arquivo
 * que decide o que pode ser servido do disco — e errar para o lado errado aqui
 * é mostrar a escala do mês passado. Ela tem teste próprio.
 *
 * `/_next/static/` é onde o compilador do Next põe o que tem o conteúdo no
 * nome. `/_next/image` e `/_next/data` NÃO entram: são conteúdo servido sob
 * demanda, e o endereço deles não muda quando o conteúdo muda.
 */
function ehArquivoDeBuild(caminho) {
  if (caminho.startsWith("/_next/static/")) return true;
  return caminho === "/favicon.svg" || caminho === "/icone192.png" || caminho === "/icone512.png";
}

self.addEventListener("activate", (evento) => evento.waitUntil((async () => {
  // Depósito de versão antiga sai inteiro. É o único jeito de recuperar de um
  // erro nesta lógica sem depender de a pessoa reinstalar o aplicativo.
  const nomes = await caches.keys();
  await Promise.all(nomes.filter((n) => n !== DEPOSITO).map((n) => caches.delete(n)));
  await self.clients.claim();
})()));

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  // Só GET, só do nosso domínio, e só arquivo de build. Qualquer coisa que não
  // passe pelas três portas segue para a rede sem este código no caminho —
  // `return` sem `respondWith` é o navegador fazendo o de sempre.
  if (pedido.method !== "GET") return;
  let url;
  try { url = new URL(pedido.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return;
  if (!ehArquivoDeBuild(url.pathname)) return;

  evento.respondWith((async () => {
    const deposito = await caches.open(DEPOSITO);
    const guardado = await deposito.match(pedido);
    if (guardado) return guardado;

    const daRede = await fetch(pedido);
    // Só guarda resposta inteira e boa. Guardar um 404 ou um 206 deixaria o
    // aplicativo quebrado até alguém limpar o cache à mão.
    if (daRede && daRede.status === 200 && daRede.type === "basic") {
      await deposito.put(pedido, daRede.clone());
      // O nome do arquivo tem o conteúdo dentro, então cada publicação
      // acrescenta endereços novos sem substituir os velhos. Sem um teto, o
      // depósito cresce para sempre. `keys()` devolve na ordem de entrada, e
      // as primeiras são as mais antigas.
      const chaves = await deposito.keys();
      if (chaves.length > 160) {
        await Promise.all(chaves.slice(0, chaves.length - 160).map((c) => deposito.delete(c)));
      }
    }
    return daRede;
  })());
});

self.addEventListener("push", (evento) => {
  // Conteúdo ilegível não pode virar exceção: o navegador reentrega a
  // notificação algumas vezes e depois desiste calado. Um aviso genérico
  // chega; um erro aqui não chega nunca.
  let dados = {};
  try {
    dados = evento.data ? evento.data.json() : {};
  } catch (_) {
    dados = {};
  }

  const titulo = dados.titulo || "AVANEST";
  const opcoes = {
    body: dados.corpo || "",
    icon: "/icone192.png",
    badge: "/icone192.png",
    // A `tag` junta notificações do mesmo assunto. Publicar a escala do mês
    // sem ela faria o telefone apitar uma vez por plantão.
    tag: dados.tag || "avanest",
    // Substituir em silêncio é para quando a notificação ANTERIOR ainda vale
    // — o número de trocas pendentes mudou de 2 para 3. Quando o assunto é
    // novo, tem de vibrar, senão o aviso da escala chega mudo.
    renotify: Boolean(dados.tag),
    data: { url: dados.url || "/dashboard" },
    // Escala e troca de plantão são assunto de trabalho, não urgência médica:
    // seguem o modo silencioso do telefone como qualquer outro aviso.
    requireInteraction: false,
  };
  evento.waitUntil(self.registration.showNotification(titulo, opcoes));
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = (evento.notification.data && evento.notification.data.url) || "/dashboard";

  // Se o AVANEST já está aberto numa aba, traz ELA para a frente em vez de
  // abrir outra. Quem trabalha com o sistema aberto o dia inteiro acabaria com
  // seis abas iguais até o fim da semana.
  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((abas) => {
      for (const aba of abas) {
        if (new URL(aba.url).pathname === new URL(destino, aba.url).pathname && "focus" in aba) {
          return aba.focus();
        }
      }
      for (const aba of abas) {
        if ("navigate" in aba && "focus" in aba) return aba.navigate(destino).then((a) => a && a.focus());
      }
      return self.clients.openWindow(destino);
    }),
  );
});
