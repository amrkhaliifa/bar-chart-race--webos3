var sheetURL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRuOz_KYEdrt8WrAqcUBAQYBUleVsQGufTRSov0NbOr2n3qKxNpMRO-MEXNdb4ugc_HYAP912l7kAOl/pub?gid=0&single=true&output=csv";

var nodes = {}; // agent -> {rect, text}
var playIndex = 0;
var playTimer = null;
var visibleFrames = [];
var prevFrame = null;

function loadCSV(url, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url, true);
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4 && xhr.status === 200) {
      callback(null, xhr.responseText);
    }
  };
  xhr.send();
}

var raceFrames = [];

function parseCSV(text) {
  var rows = [];
  var row = [];
  var field = "";
  var insideQuotes = false;

  for (var i = 0; i < text.length; i++) {
    var c = text[i];

    if (c === '"') {
      insideQuotes = !insideQuotes;
    } else if (c === "," && !insideQuotes) {
      row.push(field);
      field = "";
    } else if ((c === "\n" || c === "\r") && !insideQuotes) {
      if (field.length || row.length) {
        row.push(field);
        rows.push(row);
      }
      row = [];
      field = "";
    } else {
      field += c;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  var headers = rows.shift();

  var data = [];
  for (var r = 0; r < rows.length; r++) {
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      obj[headers[c].trim()] = (rows[r][c] || "").trim();
    }
    data.push(obj);
  }

  return data;
}

function buildSales(rows) {
  var sales = [];

  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];

    var sale = r.Sales || "";
    sale = sale.replace(/,/g, "");

    sales.push({
      date: new Date(r.Date),
      agent: r.AgentName,
      title: r.Title,
      sales: Number(sale) || 0,
    });
  }

  return sales;
}

var svg = document.getElementById("chart");

var width = window.innerWidth;
var height = window.innerHeight;

svg.setAttribute("width", width);
svg.setAttribute("height", height);

var marginTop = 80;
var chartHeight = height - marginTop - 20;

function calcLayout(groups) {
  var titles = Object.keys(groups);
  var minW = 220;

  var total = 0;
  for (var i = 0; i < titles.length; i++) {
    total += groups[titles[i]].length;
  }

  var free = width - minW * titles.length;
  var x = 10;

  var layout = {};

  for (var j = 0; j < titles.length; j++) {
    var t = titles[j];
    var w = minW + (groups[t].length / total) * free;
    layout[t] = { x: x, width: w };
    x += w;
  }

  return layout;
}

function groupByTitle(list) {
  var g = {
    PA: [],
    PC: [],
    Supervisor: [],
    "Team Leader": [],
  };

  for (var i = 0; i < list.length; i++) {
    var t = list[i].title;
    if (g[t]) g[t].push(list[i]);
  }

  return g;
}

function buildFrames(sales) {
  var dayMap = {}; // date -> agent -> cumulative total
  var allAgents = {};

  // sort by date first
  sales.sort(function (a, b) {
    return a.date - b.date;
  });

  for (var i = 0; i < sales.length; i++) {
    var s = sales[i];

    var d =
      s.date.getFullYear() +
      "-" +
      (s.date.getMonth() + 1) +
      "-" +
      s.date.getDate();

    if (!dayMap[d]) dayMap[d] = {};

    // carry previous totals forward
    for (var a in allAgents) {
      dayMap[d][a] = {
        name: a,
        title: allAgents[a].title,
        value: allAgents[a].value,
      };
    }

    if (!dayMap[d][s.agent]) {
      dayMap[d][s.agent] = {
        name: s.agent,
        title: s.title,
        value: 0,
      };
    }

    dayMap[d][s.agent].value += s.sales;

    // update master totals
    allAgents[s.agent] = dayMap[d][s.agent];
  }

  var dates = Object.keys(dayMap).sort();

  var frames = [];
  for (var j = 0; j < dates.length; j++) {
    var list = [];
    var m = dayMap[dates[j]];

    for (var k in m) list.push(m[k]);

    list.sort(function (a, b) {
      return b.value - a.value;
    });

    frames.push({
      date: dates[j],
      data: list,
    });
  }

  return frames;
}

function startPlayback() {
  if (!visibleFrames.length) return;

  function step() {
    var frame = visibleFrames[playIndex];

    document.getElementById("updated").textContent = "Updated at " + frame.date;

    drawFrame(frame, prevFrame); // 👈 pass previous frame

    prevFrame = frame; // 👈 save current as previous

    playIndex++;

    if (playIndex >= visibleFrames.length) {
      playIndex = 0;
      prevFrame = null; // reset animation base
    }

    playTimer = setTimeout(step, 2500); // faster feels more alive
  }

  step();
}

function animateAttr(el, attr, target, duration) {
  var start = Number(el.getAttribute(attr));
  if (isNaN(start)) start = 0;
  var diff = target - start;
  var steps = 20;
  var stepTime = duration / steps;
  var i = 0;

  var timer = setInterval(function () {
    i++;
    var val = start + (diff * i) / steps;
    el.setAttribute(attr, val);

    if (i >= steps) clearInterval(timer);
  }, stepTime);
}

function drawFrame(frame, prevFrame) {
  var groups = groupByTitle(frame.data);
  var layout = calcLayout(groups);
  var rowH = 32;
  var medals = ["1st", "2nd", "3rd"];
  var colors = ["#FFD700", "#C0C0C0", "#CD7F32"]; // gold, silver, bronze

  for (var title in groups) {
    var panelX = layout[title].x;
    var panelW = layout[title].width;

    // ----- PANEL TITLE -----
    if (!nodes["title_" + title]) {
      var t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("y", 40);
      t.setAttribute("text-anchor", "middle");
      t.setAttribute("font-size", "22");
      t.setAttribute("font-weight", "700");
      t.textContent = title;
      svg.appendChild(t);
      nodes["title_" + title] = t;
    }
    nodes["title_" + title].setAttribute("x", panelX + panelW / 2);

    var list = groups[title];

    // scale
    var max = 1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].value > max) max = list[i].value;
    }

    for (var r = 0; r < list.length; r++) {
      var d = list[r];
      var id = d.name;

      var y = marginTop + r * rowH;

      // ----- CREATE NODE -----
      if (!nodes[id]) {
        var rect = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        rect.setAttribute("x", panelX + 10);
        rect.setAttribute("height", rowH * 0.7);
        rect.setAttribute("rx", 6);
        rect.setAttribute("fill", "#3b82f6");
        svg.appendChild(rect);

        var name = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "text",
        );
        name.setAttribute("x", panelX + 14);
        name.setAttribute("dominant-baseline", "middle");
        name.setAttribute("font-size", "13");
        name.setAttribute("font-weight", "bold");
        name.textContent = d.name;
        svg.appendChild(name);

        var medal = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "text",
        );
        medal.setAttribute("dominant-baseline", "middle");
        medal.setAttribute("font-size", "13");
        medal.textContent = "";
        svg.appendChild(medal);

        nodes[id] = { rect: rect, text: name, medal: medal };
      } else {
        // Update fill color based on current rank
        nodes[id].rect.setAttribute("fill", r < 3 ? colors[r] : "#3b82f6");
      }

      // ----- WIDTH ANIMATION -----
      var prevValue = 0;
      if (prevFrame) {
        var p = prevFrame.data.find(function (x) {
          return x.name === d.name && x.title === d.title;
        });
        if (p) prevValue = p.value;
      }

      var prevW = (prevValue / max) * (panelW - 40);
      var targetW = (d.value / max) * (panelW - 40);

      if (prevW < 0) prevW = 0;
      if (targetW < 0) targetW = 0;
      animateAttr(nodes[id].rect, "width", targetW, 800);

      // ----- POSITION ANIMATION -----
      animateAttr(nodes[id].rect, "y", y, 800);
      animateAttr(nodes[id].text, "y", y + rowH / 2, 800);

      // ----- MEDAL -----
      var nameWidth = d.name.length * 8; // approximate width
      if (r < 3 && d.value > 0 && targetW > nameWidth + 20) {
        nodes[id].medal.textContent = medals[r];
        animateAttr(nodes[id].medal, "x", panelX + 10 + targetW + 5, 800);
        animateAttr(nodes[id].medal, "y", y + rowH / 2, 800);
      } else {
        nodes[id].medal.textContent = "";
      }
    }
  }
}

loadCSV(sheetURL, function (err, text) {
  if (err) {
    console.error("Load error");
    return;
  }

  var rows = parseCSV(text);
  console.log("Rows:", rows.length);

  var sales = buildSales(rows);
  console.log("Sales:", sales.length);

  raceFrames = buildFrames(sales);

  // keep last 7 days only
  if (raceFrames.length > 7) {
    visibleFrames = raceFrames.slice(raceFrames.length - 7);
  } else {
    visibleFrames = raceFrames;
  }

  console.log("Visible frames:", visibleFrames.length);
  console.log("Frames:", raceFrames.length);
  console.log("First frame:", raceFrames[0]);
  console.log("First sale date:", sales[0].date);
  console.log("Last sale date:", sales[sales.length - 1].date);

  if (!raceFrames.length) {
    console.error("NO FRAMES");
    return;
  }
  playIndex = 0;
  startPlayback();
});
