---
layout: page
title: Notes
permalink: /notes/
---

Here are some notes on interesting topics I'm studying in school.

<div class="home">
  {%- if site.notes.size > 0 -%}
    <ul class="collection-list">
      {%- for note in site.notes -%}
      <li>
        <a class="collection-link" href="{{ note.url | relative_url }}">
          {{ note.title | escape }}
        </a>
      </li>
      {%- endfor -%}
    </ul>

  {%- endif -%}
</div>