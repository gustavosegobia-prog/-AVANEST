const Arrow = () => <span aria-hidden="true">→</span>;
const Tick = () => <span className="tick" aria-hidden="true">✓</span>;

function GeoLogo() {
  return <span className="geoLogo" aria-hidden="true"><i className="circle"/><i className="square"/><i className="triangle"/></span>;
}

export default function Home() {
  return (
    <main id="inicio">
      <header className="nav">
        <a className="brand" href="#inicio" aria-label="AvaNEST — início"><GeoLogo/><strong>AvaNEST</strong></a>
        <nav aria-label="Navegação principal">
          <a href="#como-funciona">Como funciona</a><a href="#seguranca">Segurança</a>
          <a className="btn btnYellow btnSmall" href="/login">Entrar <Arrow/></a>
        </nav>
        <details className="mobileMenu"><summary aria-label="Abrir menu"><span></span><span></span><span></span></summary><div><a href="#como-funciona">Como funciona</a><a href="#seguranca">Segurança</a><a href="#avaliacao">Começar avaliação</a></div></details>
      </header>

      <section className="hero posterSection">
        <div className="heroCopy">
          <p className="kicker"><b>01</b> Avaliação pré-anestésica digital</p>
          <h1>Antes da<br/>cirurgia,<br/><span>segurança.</span></h1>
          <p className="heroText">Faça sua avaliação pré-anestésica de forma simples e orientada. Suas informações organizadas para uma consulta mais segura.</p>
          <div className="actions"><a className="btn btnRed" href="#avaliacao">Iniciar avaliação <Arrow/></a><a className="underLink" href="#como-funciona">Entenda o processo ↓</a></div>
          <ul className="trust"><li><Tick/> 8 minutos</li><li><Tick/> Dados protegidos</li><li><Tick/> Sem custo</li></ul>
        </div>
        <div className="heroArt" aria-label="Composição geométrica representando cuidado e precisão">
          <div className="bluePanel"></div><div className="bigCircle"></div><div className="tiltedSquare"></div><div className="crossLine"></div>
          <div className="assessmentCard">
            <div className="cardHead"><GeoLogo/><strong>AvaNEST</strong><span>03/05</span></div>
            <div className="bar"><i></i></div><p className="cardLabel">HISTÓRICO DE SAÚDE</p>
            <h2>Você possui alguma alergia?</h2><p>Inclua medicamentos, alimentos ou materiais.</p>
            <button>SIM, QUERO INFORMAR <Arrow/></button><button className="outline">NÃO POSSUO ALERGIAS</button>
          </div>
          <div className="savedStamp"><b>✓</b><span>INFORMAÇÃO<br/>SALVA</span></div>
        </div>
      </section>

      <section className="stats" aria-label="Indicadores de confiança">
        <div><span>01</span><strong>+12 MIL</strong><small>AVALIAÇÕES REALIZADAS</small></div>
        <div><span>02</span><strong>4,9/5</strong><small>SATISFAÇÃO DOS PACIENTES</small></div>
        <div><span>03</span><strong>LGPD</strong><small>PRIVACIDADE E PROTEÇÃO</small></div>
        <blockquote><b>“</b>Simples, rápido e me deixou muito mais tranquila para a cirurgia.<cite>— Mariana, paciente</cite></blockquote>
      </section>

      <section className="process posterSection" id="como-funciona">
        <header className="sectionHead"><p>02 / PROCESSO</p><h2>SIMPLES.<br/>DIRETO.<br/><span>SEGURO.</span></h2></header>
        <div className="steps">
          <article><div className="stepNo"><span>1</span></div><i className="corner circleCorner"></i><h3>CONTE SOBRE SUA SAÚDE</h3><p>Responda perguntas objetivas sobre histórico, medicamentos e hábitos.</p></article>
          <article><div className="stepNo blue"><span>2</span></div><i className="corner squareCorner"></i><h3>REVISE AS INFORMAÇÕES</h3><p>Confira tudo com calma e complete o que for necessário antes de enviar.</p></article>
          <article><div className="stepNo yellow"><span>3</span></div><i className="corner triangleCorner"></i><h3>PRONTO PARA A CONSULTA</h3><p>Sua equipe recebe um resumo organizado para um atendimento mais seguro.</p></article>
        </div>
      </section>

      <section className="security" id="seguranca">
        <div className="securityArt"><div className="securityCircle"></div><div className="securitySquare"></div><div className="securityKey">✦</div></div>
        <div className="securityCopy"><p>03 / PRIVACIDADE</p><h2>SEUS DADOS.<br/>SUAS REGRAS.</h2><div className="yellowRule"></div><p className="bodyCopy">Cuidado também significa proteger suas informações. Seguimos as boas práticas da LGPD, e suas respostas são acessadas apenas por profissionais autorizados envolvidos no seu cuidado.</p><ul><li><Tick/> TRANSMISSÃO CRIPTOGRAFADA</li><li><Tick/> ACESSO CONTROLADO</li><li><Tick/> PRIVACIDADE DESDE O INÍCIO</li></ul></div>
      </section>

      <section className="finalCta" id="avaliacao">
        <div className="ctaCircle"></div><div className="ctaSquare"></div>
        <p>04 / SUA VEZ</p><h2>PRONTO PARA<br/>COMEÇAR?</h2><p className="ctaText">Tenha seus medicamentos e exames por perto. Você pode pausar e continuar quando quiser.</p>
        <a className="btn btnBlue" href="/login">ENTRAR NO AVANEST <Arrow/></a><small>Não substitui consulta médica. Em caso de emergência, procure atendimento.</small>
      </section>

      <footer><a className="brand inverse" href="#inicio"><GeoLogo/><strong>AvaNEST</strong></a><p>AVALIAÇÃO PRÉ-ANESTÉSICA DIGITAL</p><a href="#inicio">VOLTAR AO TOPO ↑</a></footer>
    </main>
  );
}
