(function () {
  "use strict";

  var estado = { livros: { antigo: [], novo: [] }, videos: {}, busca: "", somenteGravados: false };
  var partesAtuais = [];
  var parteIndex = 0;
  var navegacaoAtual = { livro: "", capitulo: 0 };

  function normalizar(txt) {
    return String(txt)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function idDoYoutube(url) {
    var m = String(url).match(
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|live\/|shorts\/))([A-Za-z0-9_-]{6,})/
    );
    return m ? m[1] : null;
  }

  // Normaliza o valor do videos.json para uma lista de partes { titulo, url, id }
  function partesDoCapitulo(valor) {
    if (!valor) return [];
    var bruto = Array.isArray(valor) ? valor : [valor];
    var partes = [];
    bruto.forEach(function (item, i) {
      var url = typeof item === "string" ? item : item && item.url;
      if (!url) return;
      var id = idDoYoutube(url);
      if (!id) return;
      var titulo = (item && item.titulo) || (bruto.length > 1 ? "Parte " + (i + 1) : "Assistir");
      partes.push({ titulo: titulo, url: url, id: id });
    });
    return partes;
  }

  function videosDoLivro(nome) {
    var chave = Object.keys(estado.videos).filter(function (k) {
      return k.charAt(0) !== "_";
    }).find(function (k) {
      return normalizar(k) === normalizar(nome);
    });
    return chave ? estado.videos[chave] : null;
  }

  function montarLivro(livro) {
    var dados = videosDoLivro(livro.nome) || {};
    var caps = [];
    var gravados = 0;

    for (var i = 1; i <= livro.capitulos; i++) {
      var partes = partesDoCapitulo(dados[String(i)]);
      if (partes.length) gravados++;
      caps.push({ numero: i, partes: partes });
    }
    return { nome: livro.nome, total: livro.capitulos, caps: caps, gravados: gravados };
  }

  function livroPorNome(nome) {
    var encontrado = null;
    ["antigo", "novo"].some(function (testamento) {
      encontrado = (estado.livros[testamento] || []).find(function (livro) {
        return normalizar(livro.nome) === normalizar(nome);
      });
      return Boolean(encontrado);
    });
    return encontrado;
  }

  function atualizarUrl(livro, capitulo, parte, substituir) {
    var url = new URL(window.location.href);

    if (livro) url.searchParams.set("livro", livro);
    else url.searchParams.delete("livro");

    if (capitulo) url.searchParams.set("capitulo", String(capitulo));
    else url.searchParams.delete("capitulo");

    if (parte) url.searchParams.set("parte", String(parte));
    else url.searchParams.delete("parte");

    window.history[substituir ? "replaceState" : "pushState"]({}, "", url.href);
  }

  function criarCartaoLivro(livro) {
    var card = document.createElement("article");
    card.className = "livro";
    card.dataset.livro = livro.nome;

    var head = document.createElement("button");
    head.type = "button";
    head.className = "livro-cabecalho";
    head.setAttribute("aria-expanded", "false");
    head.innerHTML =
      '<span class="livro-nome"></span>' +
      '<span class="livro-meta">' +
      '<span class="pastilha"></span>' +
      '<span class="seta">&#9654;</span>' +
      "</span>";
    head.querySelector(".livro-nome").textContent = livro.nome;

    var pastilha = head.querySelector(".pastilha");
    pastilha.textContent = livro.gravados + "/" + livro.total;
    if (livro.gravados > 0) pastilha.classList.add("ativa");

    var grade = document.createElement("div");
    grade.className = "capitulos";

    livro.caps.forEach(function (cap) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cap";
      btn.textContent = cap.numero;

      if (cap.partes.length) {
        btn.classList.add("tem-video");
        btn.title = livro.nome + " " + cap.numero + " — assistir";
        if (cap.partes.length > 1) {
          var tag = document.createElement("span");
          tag.className = "partes";
          tag.textContent = cap.partes.length;
          btn.appendChild(tag);
          btn.title += " (" + cap.partes.length + " partes)";
        }
        btn.addEventListener("click", function () {
          abrirModal(livro.nome, cap.numero, cap.partes, 0, true);
        });
      } else {
        btn.disabled = true;
        btn.title = livro.nome + " " + cap.numero + " — ainda não gravado";
      }

      grade.appendChild(btn);
    });

    head.addEventListener("click", function () {
      var aberto = card.classList.toggle("aberto");
      head.setAttribute("aria-expanded", String(aberto));
      atualizarUrl(aberto ? livro.nome : "", 0, 0);
    });

    card.appendChild(head);
    card.appendChild(grade);
    return card;
  }

  function renderizar() {
    var busca = normalizar(estado.busca);
    var totalCaps = 0;
    var totalGravados = 0;

    //Para exibir o Velho testamento descomentar a linha abaixo:
    //["antigo", "novo"].forEach(function (chave) {
    ["novo"].forEach(function (chave) {
      var alvo = document.getElementById("lista-" + chave);
      var secao = document.getElementById("sec-" + chave);
      alvo.innerHTML = "";
      var visiveis = 0;

      estado.livros[chave].map(montarLivro).forEach(function (livro) {
        totalCaps += livro.total;
        totalGravados += livro.gravados;

        if (busca && normalizar(livro.nome).indexOf(busca) === -1) return;
        if (estado.somenteGravados && livro.gravados === 0) return;

        alvo.appendChild(criarCartaoLivro(livro));
        visiveis++;
      });

      secao.hidden = visiveis === 0;
    });

    document.getElementById("progresso-num").textContent = totalGravados + " de " + totalCaps;

    var estadoEl = document.getElementById("estado");
    var nada = document.getElementById("sec-antigo").hidden && document.getElementById("sec-novo").hidden;
    estadoEl.hidden = !nada;
    if (nada) estadoEl.textContent = "Nenhum livro encontrado para esta busca.";
  }

  /* ---------- Modal ---------- */

  var modal = document.getElementById("modal");
  var player = document.getElementById("player");
  var linkYoutube = document.getElementById("link-youtube");

  function mostrarParte(i, registrarHistorico) {
    parteIndex = i;
    var parte = partesAtuais[i];
    if (!parte) return;
    player.src = "https://www.youtube.com/embed/" + parte.id + "?rel=0&autoplay=1";
    linkYoutube.href = parte.url;
    Array.prototype.forEach.call(document.querySelectorAll(".parte"), function (b, idx) {
      b.setAttribute("aria-pressed", String(idx === i));
    });
    if (registrarHistorico) atualizarUrl(navegacaoAtual.livro, navegacaoAtual.capitulo, i + 1);
  }

  function abrirModal(livro, capitulo, partes, indiceInicial, registrarHistorico) {
    partesAtuais = partes;
    navegacaoAtual = { livro: livro, capitulo: capitulo };
    document.getElementById("modal-titulo").textContent = livro + " " + capitulo;

    var barra = document.getElementById("modal-partes");
    barra.innerHTML = "";
    if (partes.length > 1) {
      partes.forEach(function (p, i) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "parte";
        b.textContent = p.titulo;
        b.addEventListener("click", function () {
          mostrarParte(i, true);
        });
        barra.appendChild(b);
      });
    }

    modal.hidden = false;
    document.body.style.overflow = "hidden";
    mostrarParte(indiceInicial || 0, false);
    if (registrarHistorico) atualizarUrl(livro, capitulo, parteIndex + 1);
  }

  function fecharModal(registrarHistorico) {
    modal.hidden = true;
    player.src = "";
    document.body.style.overflow = "";
    if (registrarHistorico) atualizarUrl(navegacaoAtual.livro, 0, 0);
  }

  Array.prototype.forEach.call(modal.querySelectorAll("[data-fechar]"), function (el) {
    el.addEventListener("click", function () {
      fecharModal(true);
    });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.hidden) fecharModal(true);
  });

  function sincronizarComUrl() {
    var params = new URLSearchParams(window.location.search);
    var nomeLivro = params.get("livro");
    var livro = nomeLivro && livroPorNome(nomeLivro);
    var capitulo = Number(params.get("capitulo"));
    var parte = Number(params.get("parte"));
    var cardDoLivro = null;

    Array.prototype.forEach.call(document.querySelectorAll(".livro"), function (card) {
      var aberto = livro && normalizar(card.dataset.livro) === normalizar(livro.nome);
      card.classList.toggle("aberto", Boolean(aberto));
      card.querySelector(".livro-cabecalho").setAttribute("aria-expanded", String(Boolean(aberto)));
      if (aberto) cardDoLivro = card;
    });

    if (cardDoLivro) cardDoLivro.scrollIntoView({ behavior: "smooth", block: "start" });

    if (!livro || !capitulo) {
      if (!modal.hidden) fecharModal(false);
      return;
    }

    var livroMontado = montarLivro(livro);
    var capituloMontado = livroMontado.caps[capitulo - 1];
    if (!capituloMontado || !capituloMontado.partes.length) {
      if (!modal.hidden) fecharModal(false);
      return;
    }

    var indice = parte > 0 && parte <= capituloMontado.partes.length ? parte - 1 : 0;
    abrirModal(livro.nome, capitulo, capituloMontado.partes, indice, false);
  }

  window.addEventListener("popstate", sincronizarComUrl);

  /* ---------- Controles ---------- */

  document.getElementById("busca").addEventListener("input", function (e) {
    estado.busca = e.target.value;
    renderizar();
  });
  document.getElementById("somente-gravados").addEventListener("change", function (e) {
    estado.somenteGravados = e.target.checked;
    renderizar();
  });

  /* ---------- Carregamento ---------- */

  function carregar(arquivo) {
    return fetch(arquivo + "?v=" + Date.now(), { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("Falha ao carregar " + arquivo);
      return r.json();
    });
  }

  Promise.all([carregar("assets/json/biblia.json"), carregar("assets/json/videos.json")])
    .then(function (res) {
      estado.livros = res[0];
      estado.videos = res[1] || {};
      renderizar();
      sincronizarComUrl();
    })
    .catch(function (err) {
      console.error(err);
      var el = document.getElementById("estado");
      el.hidden = false;
      el.textContent = "Não foi possível carregar os dados. Verifique se videos.json é um JSON válido.";
    });
})();