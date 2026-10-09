import '../../../core/api/api_exception.dart';

class ServiceListing {
  const ServiceListing({
    required this.id,
    required this.title,
    required this.currency,
    required this.listingStatus,
    this.startingPriceCentavos,
  });

  final String id;
  final String title;
  final String currency;
  final String listingStatus;
  final int? startingPriceCentavos;

  factory ServiceListing.fromJson(Object? json) {
    if (json is! Map<String, Object?>) {
      throw const ApiContractException();
    }
    final id = json['id'];
    final title = json['title'];
    final currency = json['currency'];
    final listingStatus = json['listingStatus'];
    final price = json['startingPriceCentavos'];
    if (id is! String ||
        title is! String ||
        currency != 'PHP' ||
        listingStatus != 'published' ||
        (price != null && (price is! int || price < 0))) {
      throw const ApiContractException();
    }
    return ServiceListing(
      id: id,
      title: title,
      currency: currency,
      listingStatus: listingStatus,
      startingPriceCentavos: price as int?,
    );
  }
}
