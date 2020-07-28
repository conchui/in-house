"use strict";

import $ from "jquery";
import slick from "slick";

$( document ).ready(function() {

  $("#banner-page").slick({
    infinite: true,
    dots: true,
    arrows: false,
  });

  $(".main-preview").slick({
    infinite: true,
    slidesToShow: 1,
    slidesToScroll: 1,
    arrows: false,
    dots: false,
    fade: true,
    asNavFor: '.nav-preview'
  });

  $(".nav-preview").slick({
    infinite: true,
    slidesToShow: 3,
    slidesToScroll: 1,
    asNavFor: '.main-preview',
    centerMode: true,
    focusOnSelect: true,
    arrows: false,
    dots: false,
  });

  if ($(window).width() <= 768) {
    $(".partners").slick({
      infinite: true,
      slidesToShow: 3,
      slidesToScroll: 1,
      centerMode: true,
      focusOnSelect: true,
      arrows: false,
      dots: false,
      responsive: [
        {
          breakpoint: 500,
          settings: {
            slidesToShow: 2,
            slidesToScroll: 1,
            centerMode: false,
            focusOnSelect: false,
          }
        }
      ]
    });
  }

  $(".menu-button").on("click", function(){
    $(this).next(".header-menu").toggleClass("-active");
  });
});

////////////////////////////////////////
// let sampleFunction = () => {

// };