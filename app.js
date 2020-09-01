let index = -1
let vocab_map = new Map()
let solution_pos = 0
let vocab
let nextquiz
let audio_map
let syncHandler
const timeout_setting = 2000
const timeout_step = 50
let timeout_counter = 0
let db = new PouchDB("budong")

window.onload = (x) => {
  window.menu_map = {}
  setup_menu()
  check_menu_hash()

  let couchdb_url = get_couch_settings()
  if (couchdb_url != "") {
    couchdb_sync(couchdb_url)
  }

  reset_couch_settings()
  couch_input.parentElement
    .querySelector('input[value="save"]')
    .addEventListener("click", save_couch_settings)
  couch_input.parentElement
    .querySelector('input[value="cancel"]')
    .addEventListener("click", reset_couch_settings)
}

function couchdb_sync(couchdb_url) {
  var remoteDB = new PouchDB(couchdb_url)
  if (syncHandler) {
    syncHandler.cancel()
  }
  syncHandler = db.sync(remoteDB, {
    live: true,
    retry: true,
  })
  console.log(syncHandler)

  syncHandler
    .on("change", function (event) {
      // yo, something changed!
      console.log("pouch change", event)
      event.change.docs.forEach((doc) => {
        console.log("update", doc._id)
        switch (doc._id) {
          case "hits":
            fill_export()
            if(location.hash == '#progress'){
              update_progress()
            }
            break
        }
      })
    })
    .on("error", function (err) {
      // yo, we got an error! (maybe the user went offline?)
      console.log("pouch err", err)
    })
    .on("complete", function (info) {
      console.log("pouch sync stopped", info)
    })
}

function save_couch_settings() {
  let couchdb_url = couch_input.value
  if (get_couch_settings() != couchdb_url) {
    couchdb_sync(couchdb_url)
    localStorage.setItem("couch_url", couchdb_url)
  }
}

function get_couch_settings() {
  let couch_url = localStorage.getItem("couch_url")
  if (couch_url == null) {
    couch_url = ""
  }
  return couch_url
}

function reset_couch_settings() {
  couch_input.value = get_couch_settings()
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function solve(pick) {
  if (msec.dataset.solved != "false") {
    return
  }
  msec.dataset.solved = "true"
  play_sound(msec.dataset.sym)

  if (solution_pos != pick) {
    save_result(vocab[index].id, 0, 1)
    document.body.style.background =
      "linear-gradient(rgba(128, 0, 0, 0.6), rgba(0, 0, 0, 0.0) 30%)"
    nextquiz = setTimeout(quiz, timeout_setting * 2)
  } else {
    save_result(vocab[index].id, 1, 0)
    document.body.style.background =
      "linear-gradient(rgba(0, 128, 0, 0.6), rgba(0, 0, 0, 0.0) 30%)"
    nextquiz = setTimeout(quiz, timeout_setting)
  }
  let buttons = document.querySelectorAll(".btn")
  buttons.forEach((x, i) => {
    x.onclick = (x) => {
      console.log("noped")
    }
    if (i == pick) {
      x.style.fontWeight = "bold"
    }
    if (i == solution_pos) {
      x.style.background = "rgba(0, 128, 0, 0.6)"
    } else if (solution_pos != pick) {
      x.style.background = "rgba(128, 0, 0, 0.6)"
    }
  })
  timerbar.style.visibility = ""
  timerbar.style.width = "100%"
}

function timer() {
  if (timeout_counter < timeout_setting) {
    timeout_counter += timeout_step
    timerbar.style.width = (timeout_counter / timeout_setting) * 100 + "%"
    nextquiz = setTimeout(timer, timeout_step)
  } else {
    timeout_counter = 0
    timerbar.style.width = 0 + "%"
    quiz()
  }
}

document.addEventListener("keyup", (e) => {
  console.log(e)
  if (e.key >= 1 && e.key <= 4) {
    solve(e.key - 1)
  } else if (e.key == " " && msec.dataset.solved == "true") {
    clearTimeout(nextquiz)
    quiz()
  } else if (e.key == "Escape") {
    clearTimeout(nextquiz)
  }
})

let quizes = [quiz_sym_eng, quiz_eng_sym, quiz_sym_pin]

function play_sound(sym) {
  if (audio_map.hasOwnProperty(sym)) {
    var audio = new Audio("data/flac/" + audio_map[sym])
    audio.play()
  } else {
    console.log("no audio for", sym)
  }
}

function generate_answers() {
  solution_pos = Math.floor(Math.random() * 4)

  let answers = []
  let tries = 0

  while (answers.length < 4 && tries <= 200) {
    if (answers.length == solution_pos) {
      answers.push(vocab[index])
    } else {
      let rando = Math.floor(Math.random() * vocab.length)
      tries += 1
      if (
        vocab[rando].id != vocab[index].id &&
        !answers.includes(vocab[rando])
      ) {
        //check if same number of symbols
        if (
          vocab[rando].pinyin.split(" ").length ==
            vocab[index].pinyin.split(" ").length ||
          tries > 89
        ) {
          //TODO: maybe check type of word
          answers.push(vocab[rando])
        }
      }
    }
  }

  console.log(answers)
  return answers
}

function format_quiz(answer_format, title_format) {
  let answers = generate_answers()
  msec.dataset.solved = "false"
  quiz_title.innerText = title_format(vocab[index])
  msec.dataset.sym = vocab[index].hanzi
  let buttons = document.querySelectorAll(".answ")
  console.log(index, vocab[index])

  buttons.forEach((x, i) => {
    x.parentElement.style.background = ""
    x.innerText = answer_format(answers[i])
    x.parentElement.onclick = (x) => {
      solve(i)
    }
  })
}

function format_hanzi_pinyin(entry) {
  return entry.hanzi + " (" + entry.pinyin + ")"
}

function format_pinyin_trans(entry) {
  return entry.pinyin + " [" + entry.translations[0] + "]"
}

function quiz_sym_eng() {
  format_quiz(format_hanzi_pinyin, (entry) => {
    return entry.translations[0]
  })
}

function quiz_eng_sym() {
  format_quiz(format_hanzi_pinyin, (entry) => {
    return entry.translations[0]
  })
}

function quiz_sym_pin() {
  format_quiz(format_pinyin_trans, (entry) => {
    return entry.hanzi
  })
}

function get_hits(id) {
  return db
    .get("hits")
    .then(function (doc) {
      if (doc.list.hasOwnProperty(id)) {
        return doc.list[id]
      } else {
        return [0, 0]
      }
    })
    .catch(function (err) {
      return [0, 0]
    })
}

function get_hitlist() {
  return db
    .get("hits")
    .then(function (doc) {
      return doc.list
    })
    .catch(function (err) {
      return {}
    })
}

function update_hitbar() {
  get_hits(vocab[index].id).then((hits) => {
    paint_hitshits(hits)
  })
}

function save_result(id, hit, miss) {
  get_hitlist().then((hitlist) => {
    let hits = hitlist[id] || [0, 0]
    hits = [hits[0] + hit, hits[1] + miss]
    hitlist[id] = hits

    db.get("hits")
      .then()
      .then(function (hits) {
        hits.list = hitlist
        db.put(hits)
          .then(function (x) {
            console.log(x)
          })
          .catch(function (err) {
            console.log(err)
          })
      })
      .catch(function (err) {
        if (err == 404) {
          db.put({ _id: "hits", list: hitlist })
            .then(function (x) {
              console.log(x)
            })
            .catch(function (err) {
              console.log(err)
            })
        }
        console.log(err)
      })

    paint_hitshits(hits)
  })
}

function paint_hitshits(hits) {
  if (hits[0] + hits[1] != 0) {
    let percent = (hits[1] / (hits[0] + hits[1])) * 100
    hitbar.style.background = ""
    hit_filler.style.width = percent + "%"
  } else {
    hit_filler.style.width = "0%"
    hitbar.style.background = "rgb(182, 182, 158)"
  }
}

function quiz() {
  timerbar.style.visibility = "hidden"
  timerbar.style.width = 0 + "%"
  if (index < vocab.length - 1) {
    index += 1

    document.body.style.background = ""
    let buttons = document.querySelectorAll(".btn")
    buttons.forEach((x, i) => {
      x.style.fontWeight = ""
    })
    let rando_quiz = quizes[Math.floor(Math.random() * quizes.length)]
    update_hitbar()
    rando_quiz()
  } else {
    console.log("done", index)
    if (confirm("shuffle and go again?")) {
      vocab = shuffle(vocab)
      index = -1
      quiz()
    }
  }
}

function init(val) {
  index = -1

  get_hitlist().then((hitlist) => {
    val = val.filter((x) => {
      let hits = hitlist[x.id] || [0.0]
      return (hits[0] == 0 && hits[1] == 0) || hits[1] != 0
    })
    vocab = shuffle(val)

    quiz()
  })
}

fetch("data/flac/key.json").then((x) => {
  if (x.ok) {
    x.json().then((val) => {
      console.log(val)
      audio_map = val
    })
  }
})

function load_hsk(i) {
  if (vocab_map.has(i)) {
    init(vocab_map[i])
  } else {
    let url = "data/hsk-level-" + i + ".json"
    fetch(url).then((x) => {
      if (x.ok) {
        x.json().then((val) => {
          vocab_map[i] = val
          init(val)
        })
      }
    })
  }
}

function add_menu_button(title, fun, hash) {
  let mb = document.createElement("div")
  menu_map[hash] = { fun: fun, el: mb }
  mb.innerText = title
  mb.onclick = (x) => {
    location.hash = hash
    menu_heighlight(mb)
    fun()
  }
  menu.appendChild(mb)
}

function menu_heighlight(el) {
  document.querySelectorAll("#menu div").forEach((x) => {
    x.style.backgroundColor = ""
  })
  el.style.backgroundColor = "var(--highlight-bg-color)"
}

function setup_menu() {
  add_menu_button("settings (设定?)", settings, "settings")
  add_menu_button("progress 进步", show_progress, "progress")
  ;[1, 2, 3, 4, 5, 6].forEach((i) => {
    add_menu_button(
      "HSK" + i,
      (x) => {
        document.querySelector("#msec").style.display = "block"
        document.querySelector("#settings").style.display = "none"
        document.querySelector("#progress").style.display = "none"
        document.querySelector("#content").style.display = ""

        load_hsk(i)
      },
      "HSK" + i
    )
  })
}

function check_menu_hash() {
  let hslice = location.hash.slice(1)
  if (window.menu_map.hasOwnProperty(hslice)) {
    menu_heighlight(window.menu_map[hslice].el)
    window.menu_map[hslice].fun()
  } else {
    menu_heighlight(window.menu_map["HSK1"].el)
    load_hsk(1)
  }
}

function settings() {
  document.body.style.backgroundColor = ""
  document.querySelector("#content").style.display = "none"
  document.querySelector("#msec").style.display = "block"
  document.querySelector("#progress").style.display = "none"
  document.querySelector("#settings").style.display = "block"

  fill_export()
}

function fill_export() {
  get_hitlist().then((hitlist) => {
    let json = JSON.stringify(hitlist)
    exarea.value = json
  })
}

copy_export.onclick = (x) => {
  exarea.focus()
  exarea.select()
  document.execCommand("copy")
}

import_export.onclick = (x) => {
  let json_im = JSON.parse(exarea.value)

  db.get("hits")
    .then()
    .then(function (hits) {
      hits.list = json_im
      db.put(hits)
        .then(function (x) {
          console.log(x)
        })
        .catch(function (err) {
          console.log(err)
        })
    })
    .catch(function (err) {
      if (err == 404) {
        db.put({ _id: "hits", list: json_im })
          .then(function (x) {
            console.log(x)
          })
          .catch(function (err) {
            console.log(err)
          })
      }
      console.log(err)
    })

  alert("import should be done\n我希望如此")
}

cancel_export.onclick = (x) => {
  document.querySelector("#settings").style.display = "none"
  document.querySelector("#content").style.display = ""
}

function style_syms(hitlist, vocs, hskbox, hanzi = true) {
  hskbox.innerHTML = ""
  let ci = document.createElement("div")
  vocs.forEach((voc) => {
    let ci = document.createElement("div")
    ci.classList.add("ci")
    ci.title = voc.hanzi + "\n" + voc.pinyin + "\n" + voc.translations[0]
    if (hanzi) {
      ci.innerText = voc.hanzi
    }
    let hits = [0, 0]
    if (hitlist.hasOwnProperty(voc.id)) {
      hits = hitlist[voc.id]
    }
    if (hits[0] + hits[1] != 0) {
      let percent = (hits[1] / (hits[0] + hits[1])) * 100
      ci.style.backgroundImage =
        "linear-gradient(to bottom, rgba(255, 0, 0, 0.2) " +
        percent +
        "%, rgb(0, 255, 0, 0.2) " +
        percent +
        "%)"
    } else {
      ci.style.background = "rgb(182, 182, 158, 0.7)"
    }

    hskbox.appendChild(ci)
  })
}

function update_progress() {
  get_hitlist().then((hitlist) => {
    ;[1, 2, 3, 4, 5, 6].forEach((i) => {
      let hskbox = document.querySelector("#HSK" + i)
      let small_group_HSK = document.querySelector("#small_group_HSK" + i)
      if (!hskbox) {
        hskbox = document.createElement("div")
        hskbox.id = "HSK" + i
        hskbox.classList.add("hskbox")
        let title = document.createElement("h2")
        title.innerText = "HSK" + i
        title.id = "HSKt" + i
        title.classList.add("hsk_title")
        document.querySelector("#progress").appendChild(title)
        document.querySelector("#progress").appendChild(hskbox)
      }
      if (!small_group_HSK) {
        small_group_HSK = document.createElement("div")
        small_group_HSK.onclick = (x) => {
          location.href = "#HSKt" + i
        }
        small_group_HSK.id = "small_group_HSK" + i
        small_group_HSK.classList.add("small_hskgroup")
        small_hskbox = document.createElement("div")
        small_hskbox.id = "small_hskbox_HSK" + i
        small_hskbox.classList.add("small_hskbox")
        let title = document.createElement("h2")
        title.innerText = "HSK" + i
        title.classList.add("small_hsk_title")
        small_group_HSK.appendChild(small_hskbox)
        small_group_HSK.appendChild(title)
        document.querySelector("#smallboxes").appendChild(small_group_HSK)
      }

      if (vocab_map.has(i)) {
        let vocs = vocab_map[i]
        style_syms(hitlist, vocs, hskbox)
        style_syms(
          hitlist,
          vocs,
          small_group_HSK.querySelector(".small_hskbox"),
          false
        )
      } else {
        fetch("data/hsk-level-" + i + ".json").then((x) => {
          if (x.ok) {
            x.json().then((vocs) => {
              vocab_map[i] = vocs

              style_syms(hitlist, vocs, hskbox)
              style_syms(
                hitlist,
                vocs,
                small_group_HSK.querySelector(".small_hskbox"),
                false
              )
            })
          }
        })
      }
    })
  })
}

function show_progress() {
  document.body.style.backgroundColor = ""
  document.querySelector("#msec").style.display = "none"
  document.querySelector("#progress").style.display = "block"

  update_progress()
}
