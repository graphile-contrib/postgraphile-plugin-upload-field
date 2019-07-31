drop schema if exists p cascade;

create schema p;

create table p.post (
  id serial primary key,
  headline text,
  body text,
  header_image_file text
);
