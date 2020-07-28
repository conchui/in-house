"use strict";

import $ from "jquery";
import slick from "slick";

$( document ).ready(function() {

  $('.single-testimonial > .toggle').on('click', function() {
    $('.single-testimonial > .toggle').removeClass('-active');
    $(this).closest('.single-testimonial').toggleClass('-active');
  });

});