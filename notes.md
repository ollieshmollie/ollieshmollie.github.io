---
layout: page
title: Notes
permalink: /notes/
---

Here are some notes on interesting topics I'm learning in school.

<div class="home">
  {%- if site.notes.size > 0 -%}
    <ul class="post-list">
      {%- for note in site.notes -%}
      <li>
        <h3>
          <a class="post-link" href="{{ note.url | relative_url }}">
            {{ note.title | escape }}
          </a>
        </h3>
      </li>
      {%- endfor -%}
    </ul>

  {%- endif -%}
</div>