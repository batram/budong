let index = -1
let vocab_map = new Map()
let solution_pos = 0
let vocab
let results = []

let nextquiz
const timeout_setting = 2000
const timeout_step = 50
let timeout_counter = 0

let syncHandler
let db = new PouchDB("budong")

let available_quizes = [quiz_sym_eng, quiz_eng_sym, quiz_sym_pin]
let filters = [
  all_items,
  low_bobs_and_uninit,
  uninit,
  under_ten_hits,
  under_five_hits,
]
let filterer = low_bobs_and_uninit
let quizes = [quiz_sym_eng, quiz_eng_sym, quiz_sym_pin]
let limit = 100

window.onload = (x) => {
  import("./js/shader.js").then((mod) => {
    window.shader = mod
    console.log(window.shader)
  })

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
            if (location.hash == "#progress") {
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

  let buttons = document.querySelectorAll("#quiz_panel .btn")

  if (solution_pos != pick) {
    //wrong solution
    let wrong_id = buttons[pick].dataset.id
    results.push({ picked: wrong_id, real: vocab[index] })
    save_result(vocab[index].id, 0, 1)
    shader.generate_chars_svg().then((url) => {
      shader.main(url, "red")
      document.body.style.background =
        "linear-gradient(rgba(128, 0, 0, 0.6), rgba(0, 0, 0, 0.0) 30%)"
      c.style.visibility = ""
    })
    nextquiz = setTimeout(quiz, timeout_setting * 2)
  } else {
    //correct solution
    save_result(vocab[index].id, 1, 0)
    results.push({ picked: vocab[index].id, real: vocab[index] })
    shader.generate_chars_svg().then((url) => {
      document.body.style.background =
        "linear-gradient(rgba(0, 128, 0, 0.6), rgba(0, 0, 0, 0.0) 30%)"
      shader.main(url, "green")
      c.style.visibility = ""
    })
    nextquiz = setTimeout(quiz, timeout_setting)
  }

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

function get_active_panel() {
  let active_panel = document.querySelector(".panel[data-active='true']")
  return active_panel.id.replace("_panel", "")
}

document.addEventListener("keyup", (e) => {
  let active_panel = get_active_panel()
  console.log(active_panel, e)
  if (active_panel == "quiz") {
    if (e.key >= 1 && e.key <= 4) {
      solve(e.key - 1)
    } else if (e.key == " " && msec.dataset.solved == "true") {
      clearTimeout(nextquiz)
      quiz()
    } else if (e.key == "Escape") {
      clearTimeout(nextquiz)
    }
  } else if (active_panel == "start") {
    if (e.key == " " || e.key == "Enter") {
      start_button.click()
    }
  } else if (active_panel == "end") {
    if (e.key == "1" || e.key == "Escape") {
      change_options_button.click()
    } else if (e.key == "2" || e.key == " " || e.key == "Enter") {
      restart_button.click()
    }
  }
})

function play_sound(sym) {
  if (window.audio_map.hasOwnProperty(sym)) {
    var audio = new Audio("data/flac/" + window.audio_map[sym])
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
  let answs = document.querySelectorAll("#quiz_panel .answ")
  console.log(index, vocab[index])

  answs.forEach((x, i) => {
    let btn = x.parentElement
    btn.style.background = ""
    btn.dataset.id = answers[i].id
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

function pouch_get(id, fallback) {
  return db
    .get(id)
    .then((doc) => {
      return doc.list
    })
    .catch((err) => {
      console.log("pouch_get err", err)
      put_on_not_found(err, id, fallback, console.log)
      return fallback
    })
}

function put_on_not_found(err, id, value, callback) {
  if (err.status == 404) {
    db.put({
      _id: id,
      list: value,
    }).then(callback)
  }
}

function pouch_update(id, value, callback = () => {}) {
  db.get(id)
    .then((doc) => {
      //stupid stringfy compare (does not always work)
      //update only on difference
      console.log(
        JSON.stringify(doc.list) != JSON.stringify(value),
        JSON.stringify(doc.list),
        JSON.stringify(value)
      )
      if (JSON.stringify(doc.list) != JSON.stringify(value)) {
        doc.list = value
        return db.put(doc)
      }
    })
    .then((x) => {
      callback()
    })
    .catch((err) => {
      console.log("pouch_set error:", err)
      put_on_not_found(err, id, value, callback)
    })
}

function pouch_set(id, value, callback) {
  db.get(id)
    .then((doc) => {
      doc.list = value
      return db.put(doc)
    })
    .then((x) => {
      callback()
    })
    .catch((err) => {
      console.log("pouch_set error:", err)
      put_on_not_found(err, id, value, callback)
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

function start_quiz() {
  index = -1
  results = []

  get_hitlist().then((hitlist) => {
    let val = og_vocab.filter((x) => {
      return filterer(x, hitlist)
    })
    vocab = shuffle(val)

    quizes = available_quizes.filter((quiz_fun) => {
      return document.querySelector("#check_" + quiz_fun.name).checked
    })

    //TODO: maybe only save on change
    pouch_update("quiz_options", {
      quizes: quizes.map((q) => {
        return q.name
      }),
      filterer: filterer.name,
      limit: limit,
    })

    quiz()
  })
}

function quiz() {
  show_panel(quiz_panel)

  c.style.visibility = "hidden"

  timerbar.style.visibility = "hidden"
  timerbar.style.width = 0 + "%"
  let qcount = Math.min(vocab.length, limit)

  if (index < qcount - 1) {
    index += 1

    quiz_counter.innerText = "[ " + (index + 1) + " / " + qcount + " ]"

    document.body.style.background = ""
    let buttons = document.querySelectorAll("#quiz_panel .btn")
    buttons.forEach((x, i) => {
      x.style.fontWeight = ""
    })
    let rando_quiz = quizes[Math.floor(Math.random() * quizes.length)]
    update_hitbar()
    rando_quiz()
  } else {
    show_end_panel()
  }
}

function show_panel(panel) {
  document.querySelectorAll(".panel").forEach((x) => {
    x.style.display = "none"
    x.dataset.active = "false"
  })
  panel.style.display = "block"
  panel.dataset.active = "true"
}

async function show_start_panel() {
  let quiz_options = await pouch_get("quiz_options", {
    quizes: quizes.map((q) => {
      return q.name
    }),
    filterer: filterer.name,
    limit: limit,
  })

  //TODO: get rid of global variables
  limit = quiz_options.limit

  show_panel(start_panel)
  i = quiz_panel.dataset.qid
  c.style.visibility = "hidden"
  document.body.style.background = ""

  document.querySelector("#start_panel .title").innerText =
    "HSK" + i + " - options"

  available_quizes.forEach((fun) => {
    let id = "check_" + fun.name
    if (!document.querySelector("#" + id)) {
      let type_div = document.createElement("div")
      let check = document.createElement("input")
      check.type = "checkbox"
      if (quiz_options.quizes.includes(fun.name)) {
        check.setAttribute("checked", true)
      }
      check.id = id

      let label = document.createElement("label")
      label.setAttribute("for", id)
      label.innerText = fun.name

      type_div.appendChild(check)
      type_div.appendChild(label)

      quiz_types.appendChild(type_div)
    }
  })

  filters.forEach((fun) => {
    let id = "op_" + fun.name
    if (!document.querySelector("#" + id)) {
      let opt = document.createElement("option")
      opt.value = fun.name
      opt.id = id
      opt.innerText = fun.name

      filter_selector.appendChild(opt)
    }
  })

  filter_selector.value = quiz_options.filterer
  set_filter()
  filter_selector.onchange = set_filter
  update_select_count()

  limit_input.value = quiz_options.limit
  limit_input.onchange = (x) => {
    limit = parseInt(limit_input.value)
    limit_input.value = parseInt(limit_input.value)
  }

  start_button.onclick = start_quiz
}

function set_filter() {
  let i = filters
    .map((filter) => {
      return filter.name
    })
    .indexOf(filter_selector.value)

  if (i != -1) {
    filterer = filters[i]
    update_select_count()
  }
}

function update_select_count() {
  get_hitlist().then((hitlist) => {
    let test = og_vocab.filter((x) => {
      return filterer(x, hitlist)
    })
    select_title.innerText = "select items (count: " + test.length + "):"
  })
}

function under_ten_hits(x, hitlist) {
  let hits = hitlist[x.id] || [0, 0]
  return hits[0] + hits[1] < 10
}

function under_five_hits(x, hitlist) {
  let hits = hitlist[x.id] || [0, 0]
  return hits[0] + hits[1] < 5
}

function low_bobs_and_uninit(x, hitlist) {
  let hits = hitlist[x.id] || [0, 0]
  return (hits[0] == 0 && hits[1] == 0) || hits[1] != 0
}

function all_items() {
  return true
}

function uninit(x, hitlist) {
  let hits = hitlist[x.id] || [0, 0]
  return hits[0] == 0 && hits[1] == 0
}

function vocab_info(entry) {
  let el = document.createElement("div")
  el.classList.add("vocab_info")

  let hanzi = document.createElement("div")
  hanzi.innerText = entry.hanzi
  hanzi.classList.add("hanzi_info")
  el.appendChild(hanzi)

  let pinyin = document.createElement("div")
  pinyin.innerText = entry.pinyin
  pinyin.classList.add("pinyin_info")
  el.appendChild(pinyin)

  let translation = document.createElement("div")
  translation.innerText = entry.translations[0]
  translation.classList.add("translate_info")
  el.appendChild(translation)

  el.title = entry.translations.join("\n")
  return el
}

function show_end_panel() {
  hit_vocab.innerHTML = ""
  miss_vocab.innerHTML = ""

  show_panel(end_panel)
  c.style.visibility = ""

  let hits = results.filter((x) => {
    if (x.picked == x.real.id) {
      hit_vocab.appendChild(vocab_info(x.real))
      return x.real
    }
  })

  let misses = results.filter((x) => {
    if (x.picked != x.real.id) {
      miss_vocab.appendChild(vocab_info(x.real))
      return x.real
    }
  })

  hit_count.innerText = "Hits: " + hits.length
  if (hits.length == 0) {
    hit_count.style.color = "inherit"
  } else {
    hit_count.style.color = ""
  }

  miss_count.innerText = "Misses: " + misses.length
  if (misses.length == 0) {
    miss_count.style.color = "inherit"
  } else {
    miss_count.style.color = ""
  }

  change_options_button.onclick = (x) => {
    show_start_panel()
  }

  restart_button.onclick = start_quiz
}

function init(val, i) {
  quiz_panel.dataset.qid = i
  og_vocab = val
  show_start_panel()
}

fetch("data/flac/key.json").then((x) => {
  if (x.ok) {
    x.json().then((val) => {
      window.audio_map = val
    })
  }
})

function load_hsk(i) {
  if (vocab_map.has(i)) {
    init(vocab_map[i], i)
  } else {
    let url = "data/hanyu/json/hsk-level-" + i + ".json"
    fetch(url).then((x) => {
      if (x.ok) {
        x.json().then((val) => {
          vocab_map[i] = val
          init(val, i)
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
        c.style.visibility = "hidden"
        document.body.style.background = ""

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
  c.style.visibility = "hidden"
  document.body.style.background = ""

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
        fetch("data/hanyu/json/hsk-level-" + i + ".json").then((x) => {
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
  c.style.visibility = "hidden"
  document.body.style.background = ""

  update_progress()
}
