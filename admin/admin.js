(function () {
    "use strict";

    var estado = { livros: { antigo: [], novo: [] }, videos: {}, capitulosDoLivro: 0, editIndex: null };

    function normalizar(txt) {
        return String(txt)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
    }

    var selectLivro = document.getElementById("select-livro");
    var selectCapitulo = document.getElementById("select-capitulo");
    var listaPartes = document.getElementById("lista-partes");
    var btnAdicionar = document.getElementById("btn-adicionar");
    var btnCancelarEdicao = document.getElementById("btn-cancelar-edicao");
    var statusArquivo = document.getElementById("status-arquivo");
    var formParte = document.getElementById("form-parte");
    var campoSpeaker = document.getElementById("campo-speaker");
    var campoTitulo = document.getElementById("campo-titulo");
    var campoUrl = document.getElementById("campo-url");
    var campoDisable = document.getElementById("campo-disable");

    /* ---------- Carregar biblia.json e videos.json automaticamente ---------- */

    function carregar(arquivo) {
        return fetch(arquivo + "?v=" + Date.now(), { cache: "no-store" }).then(function (r) {
            if (!r.ok) throw new Error("Falha ao carregar " + arquivo);
            return r.json();
        });
    }

    Promise.all([carregar("../assets/json/biblia.json"), carregar("../assets/json/videos.json")])
        .then(function (res) {
            estado.livros = res[0];
            estado.videos = res[1] || {};
            popularSelectLivro();
            statusArquivo.textContent = "assets/json/videos.json carregado.";
            atualizarListaPartes();
        })
        .catch(function (err) {
            console.error(err);
            statusArquivo.textContent = "Não foi possível carregar biblia.json / videos.json.";
        });

    function popularSelectLivro() {
        selectLivro.innerHTML = "";

        var placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Selecione um livro";
        selectLivro.appendChild(placeholder);

        [["antigo", "Antigo Testamento"], ["novo", "Novo Testamento"]].forEach(function (par) {
            var lista = estado.livros[par[0]] || [];
            if (!lista.length) return;
            var grupo = document.createElement("optgroup");
            grupo.label = par[1];
            lista.forEach(function (livro) {
                var opt = document.createElement("option");
                opt.value = livro.nome;
                opt.textContent = livro.nome;
                opt.dataset.capitulos = livro.capitulos;
                grupo.appendChild(opt);
            });
            selectLivro.appendChild(grupo);
        });

        selectLivro.disabled = false;
    }

    /* ---------- Seleção de livro / capítulo ---------- */

    selectLivro.addEventListener("change", function () {
        var opt = selectLivro.selectedOptions[0];
        estado.capitulosDoLivro = opt && opt.dataset.capitulos ? Number(opt.dataset.capitulos) : 0;
        popularSelectCapitulo();
        cancelarEdicao();
        atualizarListaPartes();
    });

    selectCapitulo.addEventListener("change", function () {
        cancelarEdicao();
        atualizarListaPartes();
    });

    function popularSelectCapitulo() {
        selectCapitulo.innerHTML = "";
        if (!estado.capitulosDoLivro) {
            var vazio = document.createElement("option");
            vazio.value = "";
            vazio.textContent = "—";
            selectCapitulo.appendChild(vazio);
            selectCapitulo.disabled = true;
            return;
        }
        for (var i = 1; i <= estado.capitulosDoLivro; i++) {
            var opt = document.createElement("option");
            opt.value = String(i);
            opt.textContent = "Capítulo " + i;
            selectCapitulo.appendChild(opt);
        }
        selectCapitulo.disabled = false;
    }

    /* ---------- Chave real do livro dentro de videos.json ---------- */

    function chaveDoLivro(nome) {
        return Object.keys(estado.videos).find(function (k) {
            return normalizar(k) === normalizar(nome);
        });
    }

    function partesAtuais() {
        var livro = selectLivro.value;
        var capitulo = selectCapitulo.value;
        if (!livro || !capitulo) return null;
        var chave = chaveDoLivro(livro);
        if (!chave) return null;
        var valor = estado.videos[chave] && estado.videos[chave][capitulo];
        return Array.isArray(valor) ? valor : [];
    }

    /* ---------- Renderizar lista de partes ---------- */

    function atualizarListaPartes() {
        listaPartes.innerHTML = "";
        var podeAdicionar = Boolean(selectLivro.value && selectCapitulo.value);
        btnAdicionar.disabled = !podeAdicionar;

        if (!selectLivro.value || !selectCapitulo.value) {
            var vazio = document.createElement("li");
            vazio.className = "admin-lista-vazia";
            vazio.textContent = "Selecione um livro e capítulo.";
            listaPartes.appendChild(vazio);
            return;
        }

        var partes = partesAtuais() || [];
        if (!partes.length) {
            var nenhuma = document.createElement("li");
            nenhuma.className = "admin-lista-vazia";
            nenhuma.textContent = "Nenhuma parte cadastrada ainda para este capítulo.";
            listaPartes.appendChild(nenhuma);
            return;
        }

        partes.forEach(function (parte, i) {
            var li = document.createElement("li");
            li.className = "admin-parte";
            li.draggable = true;
            li.dataset.indice = i;

            var alca = document.createElement("span");
            alca.className = "admin-parte-alca";
            alca.setAttribute("aria-hidden", "true");
            alca.textContent = "⠿";

            var info = document.createElement("div");
            info.className = "admin-parte-info";
            info.innerHTML =
                "<b></b>" +
                (parte.speaker ? "<small>Speaker: " + parte.speaker + "</small>" : "") +
                "<small>URL: " + (parte.url || "(vazia)") + "</small>" +
                (parte.disable ? "<small>Disable: " + parte.disable + "</small>" : "");
            info.querySelector("b").textContent = parte.titulo || "(sem título)";

            var acoes = document.createElement("div");
            acoes.className = "admin-parte-acoes";

            var editar = document.createElement("button");
            editar.type = "button";
            editar.className = "admin-parte-editar";
            editar.textContent = "Editar";
            editar.addEventListener("click", function () {
                iniciarEdicao(i);
            });

            var remover = document.createElement("button");
            remover.type = "button";
            remover.className = "admin-parte-remover";
            remover.textContent = "Remover";
            remover.addEventListener("click", function () {
                removerParte(i);
            });

            acoes.appendChild(editar);
            acoes.appendChild(remover);

            li.appendChild(alca);
            li.appendChild(info);
            li.appendChild(acoes);
            registrarArrastar(li);
            listaPartes.appendChild(li);
        });
    }

    /* ---------- Editar parte existente ---------- */

    function iniciarEdicao(indice) {
        var partes = partesAtuais() || [];
        var parte = partes[indice];
        if (!parte) return;

        estado.editIndex = indice;
        campoSpeaker.value = parte.speaker || "";
        campoTitulo.value = parte.titulo || "";
        campoUrl.value = parte.url || "";
        campoDisable.value = parte.disable || "";

        btnAdicionar.textContent = "Salvar edição";
        btnCancelarEdicao.hidden = false;
        campoTitulo.focus();
    }

    function cancelarEdicao() {
        estado.editIndex = null;
        formParte.reset();
        btnAdicionar.textContent = "Adicionar parte";
        btnCancelarEdicao.hidden = true;
    }

    btnCancelarEdicao.addEventListener("click", cancelarEdicao);

    function removerParte(indice) {
        var chave = chaveDoLivro(selectLivro.value);
        var capitulo = selectCapitulo.value;
        if (!chave) return;
        estado.videos[chave][capitulo].splice(indice, 1);
        atualizarListaPartes();
        salvarNoServidor();
    }

    /* ---------- Arrastar e soltar para reordenar ---------- */

    function registrarArrastar(li) {
        li.addEventListener("dragstart", function (e) {
            li.classList.add("arrastando");
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", li.dataset.indice);
        });

        li.addEventListener("dragend", function () {
            li.classList.remove("arrastando");
        });

        li.addEventListener("dragover", function (e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
        });

        li.addEventListener("drop", function (e) {
            e.preventDefault();
            var origem = Number(e.dataTransfer.getData("text/plain"));
            var destino = Number(li.dataset.indice);
            reordenarPartes(origem, destino);
        });
    }

    function reordenarPartes(origem, destino) {
        if (origem === destino || isNaN(origem) || isNaN(destino)) return;
        var chave = chaveDoLivro(selectLivro.value);
        var capitulo = selectCapitulo.value;
        if (!chave) return;
        var lista = estado.videos[chave][capitulo];
        var item = lista.splice(origem, 1)[0];
        lista.splice(destino, 0, item);
        atualizarListaPartes();
        salvarNoServidor();
    }

    /* ---------- Salvar no arquivo (via servidor, sem diálogo) ---------- */

    function salvarNoServidor() {
        statusArquivo.textContent = "Salvando...";
        return fetch("save-videos.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(estado.videos),
        })
            .then(function (r) {
                return r.json().then(function (dados) {
                    if (!r.ok || !dados.ok) throw new Error(dados.erro || "Falha ao salvar.");
                });
            })
            .then(function () {
                statusArquivo.textContent = "Alterações salvas em assets/json/videos.json.";
            })
            .catch(function (err) {
                console.error(err);
                statusArquivo.textContent = "Erro ao salvar: " + err.message;
            });
    }

    /* ---------- Adicionar parte ---------- */

    formParte.addEventListener("submit", function (e) {
        e.preventDefault();

        var livro = selectLivro.value;
        var capitulo = selectCapitulo.value;
        if (!livro || !capitulo) return;

        var chave = chaveDoLivro(livro) || livro;
        // Livros com {} vazio no JSON podem ter virado [] em algum ponto; nunca indexar um array por string
        if (!estado.videos[chave] || Array.isArray(estado.videos[chave]) || typeof estado.videos[chave] !== "object") {
            estado.videos[chave] = {};
        }
        if (!Array.isArray(estado.videos[chave][capitulo])) estado.videos[chave][capitulo] = [];

        var parte = { titulo: campoTitulo.value.trim(), url: campoUrl.value.trim() };
        if (campoSpeaker.value.trim()) parte.speaker = campoSpeaker.value.trim();
        if (campoDisable.value.trim()) parte.disable = campoDisable.value.trim();

        if (estado.editIndex !== null) {
            estado.videos[chave][capitulo][estado.editIndex] = parte;
        } else {
            estado.videos[chave][capitulo].push(parte);
        }

        cancelarEdicao();
        atualizarListaPartes();
        salvarNoServidor();
    });
})();
