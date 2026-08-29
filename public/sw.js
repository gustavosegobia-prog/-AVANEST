// O service worker: o pedaço do AVANEST que continua vivo com o app fechado.
//
// Ele roda fora da página, sem acesso à tela nem ao que estava aberto. Só
// acorda quando o sistema o chama — e aqui, por dois motivos: chegou uma
// notificação, ou alguém tocou numa.
//
// DE PROPÓSITO NÃO GUARDA NADA EM CACHE. Um service worker que serve páginas
// salvas é o jeito mais fácil de um sistema clínico mostrar a escala do mês
// passado como se fosse a de hoje, sem ninguém perceber. Aqui ele faz uma
// coisa só, e nem sequer escuta `fetch`.
//
// ESTE ARQUIVO É SERVIDO CRU. Não passa pelo compilador do Next, então nada de
// TypeScript, nada de import — só JavaScript que o navegador entende sozinho.

// Assume o controle sem esperar a aba ser fechada e reaberta. Sem isto, a
// primeira versão instalada fica no ar até a pessoa fechar todas as abas do
// site — e uma correção aqui demoraria dias para chegar em quem deixa o
// sistema aberto o dia inteiro.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (evento) => evento.waitUntil(self.clients.claim()));

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
